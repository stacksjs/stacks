import { afterEach, describe, expect, it } from 'bun:test'
import {
  log,
  normalizeError,
  parseLogFormat,
  parseLogLevel,
  renderNormalizedError,
  report,
  resolveLogSettings,
} from '../src/index'

/**
 * Typed error logging + the report() chokepoint
 * (stacksjs/stacks#1932 + #1933).
 */

describe('normalizeError (stacksjs/stacks#1932)', () => {
  it('captures name/message/stack from an Error', () => {
    const n = normalizeError(new TypeError('boom'))
    expect(n.name).toBe('TypeError')
    expect(n.message).toBe('boom')
    expect(n.stack).toContain('boom')
  })

  it('walks the .cause chain', () => {
    const root = new Error('root cause')
    const wrapped = new Error('outer', { cause: root })
    const n = normalizeError(wrapped)
    expect(n.message).toBe('outer')
    expect(n.cause?.message).toBe('root cause')
  })

  it('does not infinite-loop on a circular cause', () => {
    const a = new Error('a') as Error & { cause?: unknown }
    const b = new Error('b', { cause: a }) as Error & { cause?: unknown }
    a.cause = b // circle
    const n = normalizeError(a)
    // bounded — should terminate and produce the truncation marker somewhere
    let depth = 0
    let cur = n.cause
    while (cur) { depth++; cur = cur.cause }
    expect(depth).toBeLessThanOrEqual(9)
  })

  it('handles strings, null, and plain objects', () => {
    expect(normalizeError('just a string').message).toBe('just a string')
    expect(normalizeError(null).message).toBe('null')
    expect(normalizeError({ code: 'E1' }).message).toContain('E1')
  })

  it('renders the cause chain into a printable string', () => {
    const n = normalizeError(new Error('outer', { cause: new Error('inner') }))
    const out = renderNormalizedError(n)
    expect(out).toContain('outer')
    expect(out).toContain('caused by:')
    expect(out).toContain('inner')
  })
})

describe('parseLogLevel / parseLogFormat (stacksjs/stacks#1932)', () => {
  it('accepts valid levels and the warn alias', () => {
    expect(parseLogLevel('debug')).toBe('debug')
    expect(parseLogLevel('warning')).toBe('warning')
    expect(parseLogLevel('warn')).toBe('warning')
    expect(parseLogLevel('ERROR')).toBe('error')
  })

  it('falls back on an unknown level', () => {
    expect(parseLogLevel('infoo')).toBe('info')
    expect(parseLogLevel(undefined)).toBe('info')
    expect(parseLogLevel('nonsense', 'error')).toBe('error')
  })

  it('validates format', () => {
    expect(parseLogFormat('json')).toBe('json')
    expect(parseLogFormat('text')).toBe('text')
    // unknown → env-driven default (test env is not production)
    expect(['json', 'text']).toContain(parseLogFormat('weird'))
  })
})

describe('log.error keeps the error (no more dropped second arg)', () => {
  it('does not throw for (message, error, context)', async () => {
    await expect(
      log.error('action failed', new Error('kaboom'), { requestId: 'req-1' }),
    ).resolves.toBeUndefined()
  })

  it('does not throw for the bare-error form', async () => {
    await expect(log.error(new Error('bare'))).resolves.toBeUndefined()
  })
})

describe('report() policy (stacksjs/stacks#1933)', () => {
  // report() calls log.error / log.debug on the singleton; swap them
  // for spies to assert the routing without touching disk.
  const realError = log.error
  const realDebug = log.debug

  afterEach(() => {
    log.error = realError
    log.debug = realDebug
  })

  function spy() {
    const calls: { level: 'error' | 'debug', args: unknown[] }[] = []
    log.error = (async (...args: unknown[]) => { calls.push({ level: 'error', args }) }) as typeof log.error
    log.debug = (async (...args: unknown[]) => { calls.push({ level: 'debug', args }) }) as typeof log.debug
    return calls
  }

  it('reports a 5xx / non-HTTP throw at error level', () => {
    const calls = spy()
    report(new Error('db exploded'))
    expect(calls).toHaveLength(1)
    expect(calls[0].level).toBe('error')
  })

  it('does NOT report a 4xx at error level (debug instead)', () => {
    const calls = spy()
    report({ status: 404, message: 'Not Found' })
    expect(calls).toHaveLength(1)
    expect(calls[0].level).toBe('debug')
  })

  it('treats statusCode like status', () => {
    const calls = spy()
    report({ statusCode: 422, message: 'Unprocessable' })
    expect(calls[0].level).toBe('debug')
  })

  it('reports an explicit 500 status at error', () => {
    const calls = spy()
    report({ status: 500 }, { label: 'POST /orders' })
    expect(calls[0].level).toBe('error')
    expect(calls[0].args[0]).toBe('POST /orders')
  })

  it('attaches status + context to the error call', () => {
    const calls = spy()
    report(new Error('x'), { status: 503, context: { requestId: 'r9' } })
    const ctx = calls[0].args[2] as Record<string, unknown>
    expect(ctx.status).toBe(503)
    expect(ctx.requestId).toBe('r9')
  })
})

describe('flush drains in-flight struct writes (stacksjs/stacks#1934)', () => {
  const realInfo = log.info
  afterEach(() => { log.info = realInfo })

  it('flush() does not resolve until a tracked struct write settles', async () => {
    let releaseWrite!: () => void
    const deferred = new Promise<void>((r) => { releaseWrite = r })
    // log.struct.request(status 200) emits at info → track(log.info(...)).
    log.info = (async () => { await deferred }) as typeof log.info

    log.struct.request('GET', '/x', 200, 5)

    let flushed = false
    const flushP = log.flush().then(() => { flushed = true })

    await new Promise(r => setTimeout(r, 15))
    expect(flushed).toBe(false) // still waiting on the in-flight write

    releaseWrite()
    await flushP
    expect(flushed).toBe(true)
  })
})

describe('resolveLogSettings precedence — env > config > default (stacksjs/stacks#1935)', () => {
  it('env wins over config', () => {
    const s = resolveLogSettings({ envLevel: 'debug', cfgLevel: 'error', envFormat: 'json', cfgFormat: 'text' })
    expect(s.level).toBe('debug')
    expect(s.format).toBe('json')
  })

  it('config wins over default when env is unset', () => {
    const s = resolveLogSettings({ cfgLevel: 'warning', cfgFormat: 'json' })
    expect(s.level).toBe('warning')
    expect(s.format).toBe('json')
  })

  it('falls back to defaults when neither is set', () => {
    const s = resolveLogSettings({ isProduction: false })
    expect(s.level).toBe('info')
    expect(s.format).toBe('text')
    expect(s.writeToFile).toBe(true)
  })

  it('format default is json in production', () => {
    expect(resolveLogSettings({ isProduction: true }).format).toBe('json')
  })

  it('honors writeToFile=false from config', () => {
    expect(resolveLogSettings({ cfgWriteToFile: false }).writeToFile).toBe(false)
  })

  it('invalid config level falls back rather than throwing', () => {
    expect(resolveLogSettings({ cfgLevel: 'bogus' }).level).toBe('info')
  })
})
