import { beforeEach, describe, expect, test } from 'bun:test'
import { createMemoryCache } from '../src'
import type { CacheDriver } from '@stacksjs/types'

let cache: CacheDriver

beforeEach(async () => {
  cache = createMemoryCache({ checkPeriod: 1 })
  await cache.clear()
})

describe('@stacksjs/cache - TTL behavior', () => {
  describe('set with TTL', () => {
    test('get before expiry returns the value', async () => {
      await cache.set('key', 'value', 60) // 60 second TTL
      const result = await cache.get('key')
      expect(result).toBe('value')
    })

    test('get after expiry returns undefined', async () => {
      // Use a very short TTL (1 second) and wait for expiration
      await cache.set('expiring', 'gone-soon', 1)
      // Value should exist immediately
      expect(await cache.get('expiring')).toBe('gone-soon')
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1500))
      expect(await cache.get('expiring')).toBeUndefined()
    })
  })

  describe('remember()', () => {
    test('caches result and returns cached value on second call', async () => {
      let callCount = 0
      const fetcher = async () => {
        callCount++
        return `computed-${callCount}`
      }

      const first = await cache.remember('rem-key', 60, fetcher)
      expect(first).toBe('computed-1')

      const second = await cache.remember('rem-key', 60, fetcher)
      expect(second).toBe('computed-1') // Same cached value
      expect(callCount).toBe(1) // Callback only invoked once
    })

    test('remember recomputes after TTL expires', async () => {
      let callCount = 0
      const fetcher = async () => {
        callCount++
        return `value-${callCount}`
      }

      await cache.remember('expire-rem', 1, fetcher)
      expect(callCount).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 1500))

      const result = await cache.remember('expire-rem', 1, fetcher)
      expect(result).toBe('value-2')
      expect(callCount).toBe(2)
    })
  })

  describe('rememberForever()', () => {
    test('persists value without expiration', async () => {
      let callCount = 0
      const fetcher = async () => {
        callCount++
        return `forever-${callCount}`
      }

      const first = await cache.rememberForever('forever-key', fetcher)
      expect(first).toBe('forever-1')

      const second = await cache.rememberForever('forever-key', fetcher)
      expect(second).toBe('forever-1')
      expect(callCount).toBe(1)
    })
  })

  describe('getOrSet()', () => {
    test('caches the result of the callback', async () => {
      let callCount = 0
      const fetcher = async () => {
        callCount++
        return `fetched-${callCount}`
      }

      const first = await cache.getOrSet('gos-key', fetcher, 60)
      expect(first).toBe('fetched-1')

      const second = await cache.getOrSet('gos-key', fetcher, 60)
      expect(second).toBe('fetched-1')
      expect(callCount).toBe(1)
    })
  })

  describe('setForever()', () => {
    test('stores a value that does not expire', async () => {
      await cache.setForever('perm-key', 'permanent')
      expect(await cache.get('perm-key')).toBe('permanent')

      // Wait longer than a typical short TTL
      await new Promise(resolve => setTimeout(resolve, 1500))
      expect(await cache.get('perm-key')).toBe('permanent')
    })
  })

  describe('take()', () => {
    test('gets the value and deletes it', async () => {
      await cache.set('take-key', 'take-value')
      const value = await cache.take('take-key')
      expect(value).toBe('take-value')

      const afterTake = await cache.get('take-key')
      expect(afterTake).toBeUndefined()
    })

    test('take on missing key returns undefined', async () => {
      const value = await cache.take('nonexistent')
      expect(value).toBeUndefined()
    })
  })

  describe('has() and missing()', () => {
    test('has() returns true for existing key', async () => {
      await cache.set('exists', 'yes')
      expect(await cache.has('exists')).toBe(true)
    })

    test('has() returns false for non-existing key', async () => {
      expect(await cache.has('does-not-exist')).toBe(false)
    })

    test('missing() returns true for non-existing key', async () => {
      expect(await cache.missing('nope')).toBe(true)
    })

    test('missing() returns false for existing key', async () => {
      await cache.set('present', 'here')
      expect(await cache.missing('present')).toBe(false)
    })
  })
})
