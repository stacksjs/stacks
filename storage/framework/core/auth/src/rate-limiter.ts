import { HttpError } from '@stacksjs/error-handling'

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

export interface RateLimitEntry {
  attempts: number
  lockedUntil: number
}

/**
 * Pluggable backing store for the auth rate limiter.
 *
 * Methods may be sync or async — the limiter awaits them either way. The
 * default {@link MemoryStore} is process-local (fine for single-instance and
 * dev). On a horizontally-scaled deployment the in-memory store is trivially
 * bypassed by spreading attempts across instances, so production should swap
 * in a shared store via `RateLimiter.useSharedStore()` (cache-backed; becomes
 * cluster-wide when the cache driver is Redis) or a custom `useStore()`.
 */
export interface RateLimiterStore {
  get: (key: string) => Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined
  set: (key: string, entry: RateLimitEntry, ttlMs: number) => Promise<void> | void
  delete: (key: string) => Promise<void> | void
}

const MAX_STORE_SIZE = 10_000
const EVICTION_INTERVAL = 5 * 60 * 1000 // Run eviction every 5 minutes

/** Process-local store — the default. */
class MemoryStore implements RateLimiterStore {
  private store = new Map<string, RateLimitEntry>()
  private lastEviction = Date.now()

  /**
   * Evict stale entries. Runs at the eviction interval *or* when the store
   * gets close to its max size, whichever fires first. Previously the size
   * check was AND-gated against the interval, which meant a low-traffic
   * server staying under MAX_STORE_SIZE would never evict and entries with
   * cleared lockouts would linger forever.
   */
  private evict(): void {
    const now = Date.now()
    const intervalElapsed = now - this.lastEviction >= EVICTION_INTERVAL
    const overCapacity = this.store.size >= MAX_STORE_SIZE
    if (!intervalElapsed && !overCapacity)
      return

    this.lastEviction = now
    for (const [key, value] of this.store) {
      if (value.lockedUntil > 0 && value.lockedUntil <= now)
        this.store.delete(key)
      else if (value.lockedUntil === 0 && value.attempts === 0)
        this.store.delete(key)
    }
  }

  get(key: string): RateLimitEntry | undefined {
    this.evict()
    return this.store.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }
}

/**
 * Cache-backed store. Cross-instance when the configured cache driver is
 * Redis; otherwise behaves like an in-memory store with TTL eviction. Entries
 * carry a TTL so attempts decay automatically — no separate eviction pass.
 */
class CacheStore implements RateLimiterStore {
  private prefix = 'auth:ratelimit:'

  async get(key: string): Promise<RateLimitEntry | undefined> {
    const { cache } = await import('@stacksjs/cache')
    const raw = await cache.get(`${this.prefix}${key}`)
    if (raw == null)
      return undefined
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : (raw as RateLimitEntry)
    }
    catch {
      return undefined
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    const { cache } = await import('@stacksjs/cache')
    await cache.set(`${this.prefix}${key}`, JSON.stringify(entry), Math.ceil(ttlMs / 1000))
  }

  async delete(key: string): Promise<void> {
    const { cache } = await import('@stacksjs/cache')
    await cache.remove(`${this.prefix}${key}`)
  }
}

let store: RateLimiterStore = new MemoryStore()

export class RateLimiter {
  /** Swap the backing store (e.g. a Redis/db-backed shared store). */
  static useStore(custom: RateLimiterStore): void {
    store = custom
  }

  /** Use the cache-backed store (cluster-wide when cache is Redis). */
  static useSharedStore(): void {
    store = new CacheStore()
  }

  /** Reset to the process-local in-memory store (the default). */
  static useMemoryStore(): void {
    store = new MemoryStore()
  }

  static async isRateLimited(email: string): Promise<boolean> {
    email = email.toLowerCase()

    const now = Date.now()
    const userAttempts = await store.get(email)

    if (!userAttempts)
      return false

    // If the lockout has expired, clear the entry
    if (userAttempts.lockedUntil > 0 && userAttempts.lockedUntil <= now) {
      await store.delete(email)
      return false
    }

    // Currently locked out
    return userAttempts.lockedUntil > 0
  }

  static async recordFailedAttempt(email: string): Promise<void> {
    email = email.toLowerCase()
    const now = Date.now()
    const userAttempts = (await store.get(email)) || { attempts: 0, lockedUntil: 0 }
    userAttempts.attempts++

    // Lock out after reaching max attempts
    if (userAttempts.attempts >= MAX_ATTEMPTS) {
      userAttempts.lockedUntil = now + LOCKOUT_DURATION
      userAttempts.attempts = 0
    }

    // TTL lets cache-backed entries decay on their own; the memory store
    // ignores it and relies on its own eviction pass.
    await store.set(email, userAttempts, LOCKOUT_DURATION)
  }

  static async resetAttempts(email: string): Promise<void> {
    await store.delete(email.toLowerCase())
  }

  static async validateAttempt(email: string): Promise<void> {
    if (await this.isRateLimited(email))
      throw new HttpError(429, 'Too many login attempts. Please try again later.')
  }
}
