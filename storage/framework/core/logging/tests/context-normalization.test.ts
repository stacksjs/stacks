import { describe, expect, it } from 'bun:test'
import { log, normalizeContext } from '../src/index'

/**
 * Errors embedded in structured log contexts must survive JSON
 * serialization (stacksjs/stacks#1956). `JSON.stringify(new Error())`
 * yields `{}` (message/stack are non-enumerable), so
 * `log.warn('…', { error: err })` used to emit `{ "error": {} }` —
 * zero diagnostic information.
 */

describe('normalizeContext (stacksjs/stacks#1956)', () => {
  it('converts an Error context value into a serializable shape', () => {
    const json = JSON.stringify(normalizeContext({ error: new TypeError('boom') }))
    expect(json).not.toBe('{"error":{}}')
    expect(json).toContain('"name":"TypeError"')
    expect(json).toContain('"message":"boom"')
    expect(json).toContain('"stack"')
  })

  it('preserves the .cause chain', () => {
    const ctx = normalizeContext({ error: new Error('outer', { cause: new Error('inner') }) })
    const json = JSON.stringify(ctx)
    expect(json).toContain('outer')
    expect(json).toContain('inner')
  })

  it('normalizes Errors nested in objects and arrays', () => {
    const ctx = normalizeContext({
      details: { error: new Error('deep') },
      list: [new Error('in-array')],
    })
    const json = JSON.stringify(ctx)
    expect(json).toContain('deep')
    expect(json).toContain('in-array')
  })

  it('passes primitives through untouched', () => {
    const ctx = normalizeContext({ n: 42, s: 'str', b: true, nil: null })
    expect(ctx).toEqual({ n: 42, s: 'str', b: true, nil: null })
  })

  it('does not walk class instances (Date kept by reference)', () => {
    const when = new Date()
    const ctx = normalizeContext({ when })
    expect(ctx.when).toBe(when)
  })
})

describe('log facade carries context Errors (stacksjs/stacks#1956)', () => {
  it('log.warn resolves with the router call-site shape', async () => {
    await expect(
      log.warn('[router] CSRF cookie seeding failed', { error: new Error('seed failed') }),
    ).resolves.toBeUndefined()
  })

  it('log.info resolves with a bare Error arg', async () => {
    await expect(log.info('request failed', new Error('bare'))).resolves.toBeUndefined()
  })

  it('log.debug resolves with a bare Error arg', async () => {
    await expect(log.debug(new Error('dbg'))).resolves.toBeUndefined()
  })

  it('log.error resolves with an Error in the context argument', async () => {
    await expect(
      log.error('action failed', new Error('primary'), { error: new Error('ctx-err') }),
    ).resolves.toBeUndefined()
  })
})
