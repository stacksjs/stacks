import type { StorageProvider } from 'ts-rate-limiter'
import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import process from 'node:process'
import { registerPeerSource } from '@stacksjs/bun-router'
import { config, overridesReady } from '@stacksjs/config'
import { MemoryStorage } from 'ts-rate-limiter'
import { rateLimit, resetRateLimiters } from '../src/rate-limit'
import { clientAddress, fallbackStorage, rateLimitScale, resetSharedRateLimitStorage, scaledLimit, trustedProxies, useRateLimitStorage } from '../src/security-settings'

/**
 * Route `.rateLimit()` and `rateLimit()` counted in a per-process memory
 * store, so N workers allowed N times the limit and a restart forgot every
 * count. They now count in the configured shared store (Redis), with memory
 * as the fallback, and every limit follows `config.security.rateLimit.scale`.
 * `clientAddress()` follows `config.security.trustedProxies`.
 */

let originalSecurity: unknown

beforeAll(async () => {
  await overridesReady.catch(() => undefined)
  originalSecurity = (config as any).security
})

afterEach(() => {
  delete process.env.STACKS_RATE_LIMIT_SCALE
  ;(config as any).security = originalSecurity
  resetSharedRateLimitStorage()
  resetRateLimiters()
  registerPeerSource(undefined)
})

afterAll(() => {
  resetSharedRateLimitStorage()
  resetRateLimiters()
})

async function status(attempt: Promise<void>): Promise<number> {
  try {
    await attempt
    return 200
  }
  catch (error) {
    return (error as { status?: number, statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode ?? 500
  }
}

describe('the shared rate-limit store', () => {
  it('keeps counting across limiter instances that share it (two workers, one Redis)', async () => {
    const shared = new MemoryStorage()
    useRateLimitStorage(shared)
    resetRateLimiters()

    const key = `shared-${crypto.randomUUID()}`
    expect(await status(rateLimit(key, 2, { identity: 'ip:1' }).per('minute'))).toBe(200)
    expect(await status(rateLimit(key, 2, { identity: 'ip:1' }).per('minute'))).toBe(200)

    // A second worker: fresh limiters, the same store. The budget is spent.
    resetRateLimiters()
    useRateLimitStorage(shared)
    expect(await status(rateLimit(key, 2, { identity: 'ip:1' }).per('minute'))).toBe(429)
  })

  it('without a shared store each limiter counts alone (the per-process default)', async () => {
    useRateLimitStorage(null)
    resetRateLimiters()
    const key = `local-${crypto.randomUUID()}`
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(200)
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(429)
    resetRateLimiters()
    useRateLimitStorage(null)
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(200)
  })

  it('falls back to memory, warning once, while the shared store errors', async () => {
    const broken: StorageProvider = {
      increment: async () => { throw new Error('ECONNREFUSED') },
      reset: async () => { throw new Error('ECONNREFUSED') },
    }
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      useRateLimitStorage(fallbackStorage(broken, new MemoryStorage()))
      resetRateLimiters()
      const key = `fallback-${crypto.randomUUID()}`
      expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(200)
      expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(429)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('ECONNREFUSED')
    }
    finally {
      warn.mockRestore()
    }
  })
})

describe('config.security.rateLimit.scale', () => {
  it('defaults to 1 and multiplies limits, never below 1', () => {
    ;(config as any).security = { ...(originalSecurity as object), rateLimit: { scale: 1 } }
    expect(rateLimitScale()).toBe(1)
    expect(scaledLimit(5)).toBe(5)

    ;(config as any).security = { ...(originalSecurity as object), rateLimit: { scale: 100 } }
    expect(scaledLimit(5)).toBe(500)

    ;(config as any).security = { ...(originalSecurity as object), rateLimit: { scale: 0.01 } }
    expect(scaledLimit(5)).toBe(1)
  })

  it('ignores nonsense and lets STACKS_RATE_LIMIT_SCALE win', () => {
    ;(config as any).security = { ...(originalSecurity as object), rateLimit: { scale: -3 } }
    expect(rateLimitScale()).toBe(1)
    process.env.STACKS_RATE_LIMIT_SCALE = 'abc'
    expect(rateLimitScale()).toBe(1)
    process.env.STACKS_RATE_LIMIT_SCALE = '3'
    expect(scaledLimit(2)).toBe(6)
  })

  it('applies to route limits', async () => {
    process.env.STACKS_RATE_LIMIT_SCALE = '2'
    useRateLimitStorage(null)
    resetRateLimiters()
    const key = `scaled-${crypto.randomUUID()}`
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(200)
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(200)
    expect(await status(rateLimit(key, 1, { identity: 'ip:1' }).per('minute'))).toBe(429)
  })
})

describe('config.security.trustedProxies', () => {
  const forwarded = () => new Request('https://app.test/', { headers: { 'x-forwarded-for': '203.0.113.9' } })

  it('keeps the default: a private-network peer is a trusted proxy', () => {
    ;(config as any).security = { ...(originalSecurity as object), trustedProxies: undefined }
    registerPeerSource({ requestIP: () => ({ address: '10.0.0.5' }) })
    expect(trustedProxies()).toBeUndefined()
    expect(clientAddress(forwarded())).toBe('203.0.113.9')
  })

  it('believes only the configured proxies', () => {
    ;(config as any).security = { ...(originalSecurity as object), trustedProxies: ['192.168.0.0/16'] }
    registerPeerSource({ requestIP: () => ({ address: '10.0.0.5' }) })
    // A neighbour on the private network can no longer pick its own address.
    expect(clientAddress(forwarded())).toBe('10.0.0.5')

    registerPeerSource({ requestIP: () => ({ address: '192.168.1.2' }) })
    expect(clientAddress(forwarded())).toBe('203.0.113.9')
  })

  it('an empty list trusts no forwarding header', () => {
    ;(config as any).security = { ...(originalSecurity as object), trustedProxies: [] }
    registerPeerSource({ requestIP: () => ({ address: '127.0.0.1' }) })
    expect(clientAddress(forwarded())).toBe('127.0.0.1')
  })

  it('explicit options still win', () => {
    ;(config as any).security = { ...(originalSecurity as object), trustedProxies: [] }
    registerPeerSource({ requestIP: () => ({ address: '10.0.0.5' }) })
    expect(clientAddress(forwarded(), { trustedProxies: ['10.0.0.0/8'] })).toBe('203.0.113.9')
  })
})
