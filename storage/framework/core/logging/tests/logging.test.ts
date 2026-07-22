import { describe, expect, it } from 'bun:test'
import { log, dump, dd, withLogContext, getLogContext, formatMessage } from '../src/index'

// A missing trailing context/format arg used to render as a stray
// " undefined" at the end of a log line, e.g.
//   WARN Could not auto-create database "bughq": ... create database undefined
// (stacksjs/stacks#2047).
describe('formatMessage - drops undefined args (stacksjs/stacks#2047)', () => {
  it('drops a trailing undefined arg instead of appending " undefined"', () => {
    expect(formatMessage('permission denied to create database', undefined)).toBe('permission denied to create database')
  })

  it('drops undefined regardless of position', () => {
    expect(formatMessage('a', undefined, 'b')).toBe('a b')
  })

  it('renders a lone undefined as an empty string, not "undefined"', () => {
    expect(formatMessage(undefined)).toBe('')
  })

  it('keeps a normal multi-arg message intact', () => {
    expect(formatMessage('hello', 'world', 123)).toBe('hello world 123')
  })

  it('keeps null (a deliberate value) rather than dropping it', () => {
    expect(formatMessage('value is', null)).toBe('value is null')
  })
})

describe('@stacksjs/logging', () => {
  describe('log.info()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.info('test info message')).resolves.toBeUndefined()
    })

    it('does not throw with multiple arguments', async () => {
      await expect(log.info('msg', 'extra', 123)).resolves.toBeUndefined()
    })
  })

  describe('log.error()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.error('test error message')).resolves.toBeUndefined()
    })

    it('does not throw with an Error object', async () => {
      await expect(log.error(new Error('test'))).resolves.toBeUndefined()
    })

    it('does not throw with an object argument', async () => {
      await expect(log.error({ code: 'ERR_01' })).resolves.toBeUndefined()
    })
  })

  describe('log.warn()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.warn('test warning')).resolves.toBeUndefined()
    })
  })

  describe('log.debug()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.debug('debug info')).resolves.toBeUndefined()
    })

    it('does not throw with multiple arguments', async () => {
      await expect(log.debug('key', { nested: true })).resolves.toBeUndefined()
    })
  })

  describe('log.success()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.success('operation complete')).resolves.toBeUndefined()
    })
  })

  describe('log.time()', () => {
    it('returns a function', () => {
      const end = log.time('operation')
      expect(typeof end).toBe('function')
    })

    it('returned callback resolves without throwing', async () => {
      const end = log.time('db-query')
      // Simulate some elapsed time
      await new Promise(resolve => setTimeout(resolve, 5))
      await expect(end()).resolves.toBeUndefined()
    })

    it('returned callback accepts metadata', async () => {
      const end = log.time('api-call')
      await expect(end({ endpoint: '/users' })).resolves.toBeUndefined()
    })
  })

  describe('log.dump()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.dump('dump output')).resolves.toBeUndefined()
    })

    it('does not throw with an object argument', async () => {
      await expect(log.dump({ foo: 'bar' })).resolves.toBeUndefined()
    })
  })

  describe('log.echo()', () => {
    it('does not throw with a string argument', async () => {
      await expect(log.echo('echo output')).resolves.toBeUndefined()
    })
  })

  describe('standalone dump()', () => {
    it('exists and is a function', () => {
      expect(typeof dump).toBe('function')
    })

    it('does not throw', async () => {
      await expect(dump('value1', 'value2')).resolves.toBeUndefined()
    })
  })

  describe('standalone dd()', () => {
    it('exists and is a function', () => {
      expect(typeof dd).toBe('function')
    })
  })

  describe('withLogContext / getLogContext', () => {
    it('propagates context within the callback', () => {
      withLogContext({ requestId: 'req-123' }, () => {
        const ctx = getLogContext()
        expect(ctx).toBeDefined()
        expect(ctx?.requestId).toBe('req-123')
      })
    })

    it('supports arbitrary context keys', () => {
      withLogContext({ requestId: 'r1', userId: 42, extra: 'data' }, () => {
        const ctx = getLogContext()
        expect(ctx?.userId).toBe(42)
        expect(ctx?.extra).toBe('data')
      })
    })

    it('returns undefined outside of a context', () => {
      const ctx = getLogContext()
      expect(ctx).toBeUndefined()
    })

    it('returns the callback return value', () => {
      const result = withLogContext({ requestId: 'r1' }, () => {
        return 'hello from context'
      })
      expect(result).toBe('hello from context')
    })
  })
})
