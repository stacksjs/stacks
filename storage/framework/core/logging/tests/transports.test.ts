/**
 * Transports: the seam for shipping the log stream somewhere else.
 *
 * The framework logs at every interesting point already. Before this existed,
 * the only injectable hook was clarity's `formatter`, which is the wrong shape
 * for the job: it is handed the finished string, after the level has been
 * flattened and after an `Error` has been rendered into text. Anything wanting
 * to build structured output had to parse back out what the logger had just
 * finished formatting.
 *
 * So the contract these tests pin down is mostly about what survives: the raw
 * arguments, the severity, and the request context.
 */

import type { LogRecord, LogTransport } from '@stacksjs/types'
import { afterEach, describe, expect, it } from 'bun:test'
import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'
import { log, registerTransport, transports, withLogContext } from '../src'

const TRACE_KEY = Symbol.for('stacks.router.traceStorage')

let detachers: Array<() => void> = []

/** Attach a sink that records everything it is given, and clean it up after. */
function sink(options: Partial<LogTransport> = {}): LogRecord[] {
  const records: LogRecord[] = []
  detachers.push(registerTransport({
    name: options.name ?? 'test-sink',
    level: options.level,
    log: record => records.push(record),
    flush: options.flush,
  }))
  return records
}

afterEach(() => {
  for (const detach of detachers) detach()
  detachers = []
  delete (globalThis as Record<symbol, unknown>)[TRACE_KEY]
})

describe('registration', () => {
  it('delivers to a registered transport', async () => {
    const records = sink()

    await log.info('checkout started')

    expect(records).toHaveLength(1)
    expect(records[0]!.level).toBe('info')
    expect(records[0]!.message).toBe('checkout started')
  })

  it('stops delivering once detached', async () => {
    const records = sink()
    await log.info('before')

    detachers.pop()!()
    await log.info('after')

    expect(records.map(r => r.message)).toEqual(['before'])
  })

  it('delivers to every attached transport', async () => {
    const first = sink({ name: 'first' })
    const second = sink({ name: 'second' })

    await log.info('fan out')

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
  })

  it('reports the attached list without handing over the internals', () => {
    sink({ name: 'listed' })

    const attached = transports()
    expect(attached.some(t => t.name === 'listed')).toBe(true)

    // Mutating the returned array must not detach anything.
    ;(attached as LogTransport[]).length = 0
    expect(transports().some(t => t.name === 'listed')).toBe(true)
  })

  it('ignores a malformed transport instead of throwing', () => {
    const before = transports().length

    // No `log`, and no name. Both are refused, and neither takes the process
    // down: a bad entry in `config/logging.ts` should not stop the app booting.
    expect(() => registerTransport({ name: 'no-log' } as unknown as LogTransport)).not.toThrow()
    expect(() => registerTransport({ log: () => {} } as unknown as LogTransport)).not.toThrow()

    expect(transports()).toHaveLength(before)
  })
})

describe('the record', () => {
  it('carries the arguments before formatting flattened them', async () => {
    const records = sink()
    const boom = new Error('gateway timeout')

    await log.error('payment failed', boom, { provider: 'stripe' })

    const record = records[0]!
    // The formatted line is there for anyone writing text...
    expect(record.message).toContain('payment failed')
    // ...but the Error is still an Error, which is the entire point.
    expect(record.args[0]).toBe('payment failed')
    expect(record.args[1]).toBe(boom)
    expect((record.args[1] as Error).stack).toBeDefined()
    expect(record.args[2]).toEqual({ provider: 'stripe' })
  })

  it('keeps a context object an object rather than a printed blob', async () => {
    const records = sink()

    await log.warn('slow query', { sql: 'select 1', durationMs: 900 })

    expect(records[0]!.args[1]).toEqual({ sql: 'select 1', durationMs: 900 })
  })

  it('stamps a timestamp and the active trace id', async () => {
    const records = sink()
    const storage = new AsyncLocalStorage<string>()
    ;(globalThis as Record<symbol, unknown>)[TRACE_KEY] = storage

    await storage.run('req_abc', async () => {
      await withLogContext({ userId: 7 }, () => log.info('inside a request'))
    })

    const record = records[0]!
    expect(record.context?.trace_id).toBe('req_abc')
    expect(record.context?.userId).toBe(7)
    expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false)
  })

  it('reports each severity under its own name', async () => {
    const records = sink()

    await log.info('i')
    await log.success('s')
    await log.warn('w')
    await log.warning('w2')
    await log.error('e')

    expect(records.map(r => r.level)).toEqual(['info', 'success', 'warning', 'warning', 'error'])
  })
})

describe('level filtering', () => {
  it('drops anything below the transport threshold', async () => {
    const records = sink({ level: 'warning' })

    await log.info('ignored')
    await log.warn('kept')
    await log.error('kept too')

    expect(records.map(r => r.message)).toEqual(['kept', 'kept too'])
  })

  it('treats success as an info-level outcome, not a severity', async () => {
    const records = sink({ level: 'warning' })

    await log.success('deployed')

    // `success` is how a thing went, not how bad it is. A transport asking for
    // warnings and above is not asking for good news.
    expect(records).toHaveLength(0)
  })

  it('receives debug lines the console is configured to suppress', async () => {
    const previous = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'info'
    const records = sink()

    try {
      await log.debug('under the console threshold')
      // A transport is allowed to be more verbose than the terminal. Shipping
      // debug to a log service while keeping the console at info is normal.
      expect(records.map(r => r.message)).toEqual(['under the console threshold'])
    }
    finally {
      if (previous === undefined) delete process.env.LOG_LEVEL
      else process.env.LOG_LEVEL = previous
    }
  })
})

describe('isolation', () => {
  it('keeps logging when a transport throws', async () => {
    const good: LogRecord[] = []
    detachers.push(registerTransport({
      name: 'throws',
      log: () => { throw new Error('transport is broken') },
    }))
    detachers.push(registerTransport({
      name: 'fine',
      log: record => good.push(record),
    }))

    // The logger is very often the thing reporting a failure. It must not
    // become a second one, and a broken transport must not starve a working
    // one registered after it.
    await log.info('still logged')

    expect(good.map(r => r.message)).toEqual(['still logged'])
  })

  it('flushes a buffering transport', async () => {
    let flushed = 0
    const buffered: LogRecord[] = []
    detachers.push(registerTransport({
      name: 'buffered',
      log: record => buffered.push(record),
      flush: async () => { flushed++ },
    }))

    await log.info('buffer me')
    await log.flush()

    expect(buffered).toHaveLength(1)
    expect(flushed).toBe(1)
  })

  it('survives a transport whose flush rejects', () => {
    detachers.push(registerTransport({
      name: 'bad-flush',
      log: () => {},
      flush: async () => { throw new Error('drain failed') },
    }))

    // `log.flush()` is on every exit path, including `log.exit`. A transport
    // that cannot drain must not turn a clean shutdown into a crash.
    return expect(log.flush()).resolves.toBeUndefined()
  })
})
