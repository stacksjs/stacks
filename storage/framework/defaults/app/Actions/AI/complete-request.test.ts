import type { CompleteRequestDeps } from './complete-request'
import { describe, expect, test } from 'bun:test'
import { COMPLETE_MAX_BEFORE, handleCompleteRequest, parseCompleteBody } from './complete-request'

function deps(overrides: Partial<CompleteRequestDeps> = {}): CompleteRequestDeps & { calls: unknown[], limited: Array<number | string> } {
  const calls: unknown[] = []
  const limited: Array<number | string> = []
  return {
    calls,
    limited,
    body: { before: 'Remember to buy ', kind: 'todo' },
    config: { default: 'anthropic' },
    authenticate: async () => ({ id: 7 }),
    limit: async (id) => { limited.push(id) },
    available: () => true,
    complete: async (input) => {
      calls.push(input)
      return { completion: 'milk' }
    },
    ...overrides,
  }
}

describe('POST /ai/complete', () => {
  test('requires a signed-in user', async () => {
    const d = deps({ authenticate: async () => undefined })
    const result = await handleCompleteRequest(d)
    expect(result.status).toBe(401)
    expect(d.calls).toHaveLength(0)
    expect(d.limited).toHaveLength(0)
  })

  test('an auth backend failure is a 503, not a silent pass', async () => {
    const result = await handleCompleteRequest(deps({ authenticate: async () => { throw new Error('db down') } }))
    expect(result.status).toBe(503)
  })

  test('validates the body', async () => {
    expect((await handleCompleteRequest(deps({ body: {} }))).status).toBe(422)
    expect((await handleCompleteRequest(deps({ body: { before: 5 } }))).status).toBe(422)
    expect((await handleCompleteRequest(deps({ body: { before: 'x', kind: 'poem' } }))).status).toBe(422)
    expect((await handleCompleteRequest(deps({ body: { before: 'x', after: 5 } }))).status).toBe(422)
    expect((await handleCompleteRequest(deps({ body: { before: 'x'.repeat(COMPLETE_MAX_BEFORE + 1) } }))).status).toBe(422)
    expect(parseCompleteBody({ before: 'x' })).toEqual({ ok: true, value: { before: 'x', after: '', kind: 'text', context: '' } })
  })

  test('returns the completion and spends one slot of that user\'s budget', async () => {
    const d = deps({ body: { before: 'Remember to buy ', after: '', kind: 'todo', context: 'Groceries' } })
    const result = await handleCompleteRequest(d)
    expect(result).toEqual({ status: 200, body: { completion: 'milk' } })
    expect(d.limited).toEqual([7])
    expect(d.calls[0]).toMatchObject({ before: 'Remember to buy ', kind: 'todo', context: 'Groceries' })
  })

  test('answers an empty completion, not an error, when no AI driver is configured', async () => {
    const d = deps({ available: () => false })
    const result = await handleCompleteRequest(d)
    expect(result).toEqual({ status: 200, body: { completion: '' } })
    expect(d.calls).toHaveLength(0)
    expect(d.limited).toHaveLength(0)
  })

  test('nothing to continue is an empty completion without a model call', async () => {
    const d = deps({ body: { before: '  \n' } })
    expect(await handleCompleteRequest(d)).toEqual({ status: 200, body: { completion: '' } })
    expect(d.calls).toHaveLength(0)
  })

  test('a provider failure is a 502 with a clear message', async () => {
    const logged: string[] = []
    const result = await handleCompleteRequest(deps({
      complete: async () => { throw new Error('Claude API error: overloaded') },
      log: message => void logged.push(message),
    }))
    expect(result.status).toBe(502)
    expect(result.body).toEqual({ message: 'The AI provider could not complete the text.' })
    expect(logged).toHaveLength(1)
  })

  test('an aborted request is not reported as a failure', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const result = await handleCompleteRequest(deps({ complete: async () => { throw abort } }))
    expect(result).toEqual({ status: 200, body: { completion: '' } })
  })

  test('the rate limit rejection propagates for the framework to turn into a 429', async () => {
    const d = deps({ limit: async () => { throw Object.assign(new Error('Too many requests'), { status: 429 }) } })
    await expect(handleCompleteRequest(d)).rejects.toMatchObject({ status: 429 })
    expect(d.calls).toHaveLength(0)
  })
})
