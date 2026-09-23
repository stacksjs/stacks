import { HttpError } from '@stacksjs/error-handling'

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds

export interface RateLimitEntry {
  attempts: number
  lockedUntil: number
}

function recordFailure(current: RateLimitEntry | undefined, now: number): RateLimitEntry {
  const expired = current && current.lockedUntil > 0 && current.lockedUntil <= now
  const entry = current && !expired ? current : { attempts: 0, lockedUntil: 0 }
  entry.attempts++
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION
    entry.attempts = 0
  }
  return entry
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

const INITIAL_EVICTION_SIZE = 10_000
const EVICTION_INTERVAL = 5 * 60 * 1000 // Run eviction every 5 minutes

/** Process-local store — the default. */
class MemoryStore implements RateLimiterStore {
  private store = new Map<string, { entry: RateLimitEntry, expiresAt: number }>()
  private lastEviction = Date.now()
  private nextEvictionSize = INITIAL_EVICTION_SIZE

  /**
   * Sweep periodically or after substantial growth. This is a cleanup
   * threshold, not a hard capacity: evicting live counters would weaken
   * lockouts. Geometric growth amortizes scans while all entries remain live.
   */
  private evict(): void {
    const now = Date.now()
    const intervalElapsed = now - this.lastEviction >= EVICTION_INTERVAL
    const grew = this.store.size >= this.nextEvictionSize
    if (!intervalElapsed && !grew)
      return

    this.lastEviction = now
    for (const [key, value] of this.store) {
      if (value.expiresAt <= now)
        this.store.delete(key)
      else if (value.entry.lockedUntil === 0 && value.entry.attempts === 0)
        this.store.delete(key)
    }
    this.nextEvictionSize = Math.max(INITIAL_EVICTION_SIZE, this.store.size * 2)
  }

  get(key: string): RateLimitEntry | undefined {
    this.evict()
    const value = this.store.get(key)
    // Respect the TTL on every read, even between periodic cleanup passes.
    // Partial counters also expire; they need not reach lockout first.
    if (value && value.expiresAt <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return value?.entry
  }

  set(key: string, entry: RateLimitEntry, ttlMs: number): void {
    this.store.set(key, { entry, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  recordFailedAttempt(key: string, now: number): void {
    // No await between reading and writing: simultaneous first attempts must
    // not all observe an absent entry and overwrite each other with count 1.
    this.set(key, recordFailure(this.get(key), now), LOCKOUT_DURATION)
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

    // A stale read must not delete a lockout renewed by another caller.
    // Stores own TTL eviction; recording a failure resets expired counters.
    return userAttempts.lockedUntil > now
  }

  static async recordFailedAttempt(email: string): Promise<void> {
    email = email.toLowerCase()
    const now = Date.now()
    if (store instanceof MemoryStore) {
      store.recordFailedAttempt(email, now)
      return
    }

    // Preserve the pluggable store contract and TTL. Separate asynchronous
    // get/set calls do not promise an atomic distributed increment.
    const entry = recordFailure(await store.get(email), now)
    await store.set(email, entry, LOCKOUT_DURATION)
  }

  static async resetAttempts(email: string): Promise<void> {
    await store.delete(email.toLowerCase())
  }

  static async validateAttempt(email: string): Promise<void> {
    if (await this.isRateLimited(email))
      throw new HttpError(429, 'Too many login attempts. Please try again later.')
  }
}
