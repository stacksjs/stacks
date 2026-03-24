import { describe, expect, test } from 'bun:test'
import { log, withLogContext, getLogContext, dump } from '../src/index'

// ---------------------------------------------------------------------------
// log.info / warn / error / debug do not crash
// ---------------------------------------------------------------------------
describe('log methods do not crash', () => {
  test('log.info with a string', async () => {
    await expect(log.info('integration test info')).resolves.toBeUndefined()
  })

  test('log.warn with a string', async () => {
    await expect(log.warn('integration test warn')).resolves.toBeUndefined()
  })

  test('log.error with a string', async () => {
    await expect(log.error('integration test error')).resolves.toBeUndefined()
  })

  test('log.error with an Error object', async () => {
    await expect(log.error(new Error('test error object'))).resolves.toBeUndefined()
  })

  test('log.debug with a string', async () => {
    await expect(log.debug('integration test debug')).resolves.toBeUndefined()
  })

  test('log.success with a string', async () => {
    await expect(log.success('integration test success')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// log.dump
// ---------------------------------------------------------------------------
describe('log.dump', () => {
  test('dump does not crash with string', async () => {
    await expect(log.dump('dump test')).resolves.toBeUndefined()
  })

  test('dump does not crash with object', async () => {
    await expect(log.dump({ key: 'value' })).resolves.toBeUndefined()
  })

  test('standalone dump function works', async () => {
    await expect(dump('standalone dump')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// log.time
// ---------------------------------------------------------------------------
describe('log.time', () => {
  test('returns a function that resolves', async () => {
    const end = log.time('test-timer')
    expect(typeof end).toBe('function')
    await expect(end()).resolves.toBeUndefined()
  })

  test('timer measures non-negative duration', async () => {
    const end = log.time('duration-test')
    // small delay to ensure measurable time
    let sum = 0
    for (let i = 0; i < 100000; i++) sum += i
    // just call end and make sure it resolves without error
    await expect(end({ iterations: sum })).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// withLogContext / getLogContext
// ---------------------------------------------------------------------------
describe('withLogContext', () => {
  test('propagates requestId inside callback', () => {
    withLogContext({ requestId: 'req-abc-123' }, () => {
      const ctx = getLogContext()
      expect(ctx).toBeDefined()
      expect(ctx?.requestId).toBe('req-abc-123')
    })
  })

  test('context is undefined outside of withLogContext', () => {
    const ctx = getLogContext()
    expect(ctx).toBeUndefined()
  })

  test('nested context overrides outer context', () => {
    withLogContext({ requestId: 'outer' }, () => {
      withLogContext({ requestId: 'inner' }, () => {
        const ctx = getLogContext()
        expect(ctx?.requestId).toBe('inner')
      })
    })
  })

  test('context supports custom keys', () => {
    withLogContext({ requestId: 'req-1', userId: 42 }, () => {
      const ctx = getLogContext()
      expect(ctx?.userId).toBe(42)
    })
  })
})

// ---------------------------------------------------------------------------
// log.echo
// ---------------------------------------------------------------------------
describe('log.echo', () => {
  test('echo does not crash', async () => {
    await expect(log.echo('echo test')).resolves.toBeUndefined()
  })
})
