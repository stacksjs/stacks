import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { log, logger, normalizeContext, struct } from '../src/index'

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

/**
 * Output-asserting regressions: the wiring matters, not just the
 * helpers. These patch the underlying clarity logger instance and pin
 * what actually reaches the transport, so removing a normalize call
 * (or re-loosening the legacy-options heuristic) fails loudly.
 */
describe('emitted lines preserve embedded Errors (stacksjs/stacks#1956)', () => {
  type LoggerMethod = 'error' | 'warn' | 'info' | 'debug'
  const lines: string[] = []
  let restore: () => void

  beforeEach(async () => {
    const instance = await logger() as unknown as Record<LoggerMethod, (...args: unknown[]) => Promise<void>>
    const saved = new Map<LoggerMethod, (...args: unknown[]) => Promise<void>>()
    for (const level of ['error', 'warn', 'info', 'debug'] as const) {
      saved.set(level, instance[level])
      instance[level] = async (...args: unknown[]) => {
        lines.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      }
    }
    restore = () => {
      for (const [level, fn] of saved) instance[level] = fn
    }
    lines.length = 0
  })

  afterEach(() => restore())

  it('log.error(msg, contextObject) keeps embedded Errors (commerce call-site shape)', async () => {
    await log.error('[commerce/errors] update failed', { id: 5, error: new Error('update-boom') })
    const line = lines.at(-1)!
    expect(line).not.toContain('"error":{}')
    expect(line).toContain('"id":5')
    expect(line).toContain('"message":"update-boom"')
    expect(line).toContain('"stack"')
  })

  it('does not swallow { type, message, error } contexts as legacy options', async () => {
    await log.error('[commerce/errors] resolveGroup failed', { type: 'TypeError', message: 'M', error: new Error('group-boom') })
    const line = lines.at(-1)!
    expect(line).toContain('"type":"TypeError"')
    expect(line).toContain('"message":"M"')
    expect(line).toContain('group-boom')
  })

  it('still treats { shouldExit: false } as legacy options (not context)', async () => {
    await log.error(new Error('fatal-ish'), { shouldExit: false })
    const line = lines.at(-1)!
    expect(line).toContain('fatal-ish')
    expect(line).not.toContain('shouldExit')
  })

  it('log.struct.request error level (5xx) keeps Errors in fields', async () => {
    struct.request('GET', '/x', 500, 5, { error: new Error('req-boom') })
    await log.flush()
    const line = lines.at(-1)!
    expect(line).toContain('http.request')
    expect(line).not.toContain('"error":{}')
    expect(line).toContain('req-boom')
  })

  it('log.struct.job failed keeps Errors in fields', async () => {
    struct.job('emails:send', 'failed', { error: new Error('job-boom') })
    await log.flush()
    const line = lines.at(-1)!
    expect(line).toContain('job.failed')
    expect(line).not.toContain('"error":{}')
    expect(line).toContain('job-boom')
  })

  it('log.warn context wiring stays normalized (router call-site shape)', async () => {
    await log.warn('[router] CSRF cookie seeding failed', { error: new Error('seed failed') })
    const line = lines.at(-1)!
    expect(line).not.toContain('"error":{}')
    expect(line).toContain('seed failed')
  })
})
