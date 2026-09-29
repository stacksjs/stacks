import { HttpError } from '@stacksjs/error-handling'
import { RedisClient } from 'bun'

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
 * in the atomic Redis store via `RateLimiter.useSharedStore()` or provide a
 * custom store whose `recordFailedAttempt` operation is atomic.
 */
export interface RateLimiterStore {
  get: (key: string) => Promise<RateLimitEntry | undefined> | RateLimitEntry | undefined
  set: (key: string, entry: RateLimitEntry, ttlMs: number) => Promise<void> | void
  delete: (key: string) => Promise<void> | void
  /** Required for stores shared across processes. */
  recordFailedAttempt?: (key: string, now: number, ttlMs: number) => Promise<void> | void
  close?: () => Promise<void> | void
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

export interface RedisRateLimiterStoreOptions {
  url?: string
  prefix?: string
}

const RECORD_FAILURE_SCRIPT = `
local attempts = 0
local locked_until = 0
local raw = redis.call('GET', KEYS[1])
if raw then
  local decoded_ok, decoded = pcall(cjson.decode, raw)
  if decoded_ok and type(decoded) == 'table' then
    attempts = tonumber(decoded.attempts) or 0
    locked_until = tonumber(decoded.lockedUntil) or 0
  end
end
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
if locked_until > 0 and locked_until <= now then
  attempts = 0
  locked_until = 0
end
attempts = attempts + 1
if attempts >= maximum then
  locked_until = now + ttl
  attempts = 0
end
redis.call('SET', KEYS[1], cjson.encode({ attempts = attempts, lockedUntil = locked_until }), 'PX', ttl)
return locked_until
`

function redisUrl(options: RedisRateLimiterStoreOptions, configured: {
  driver?: string
  prefix?: string
  drivers?: { redis?: {
    url?: string
    host?: string
    port?: number
    username?: string
    password?: string
    database?: number
    tls?: boolean
  } }
}): { url: string, prefix: string } {
  const redis = configured.drivers?.redis
  if (options.url)
    return { url: options.url, prefix: options.prefix ?? configured.prefix ?? 'stacks' }
  if (configured.driver !== 'redis' || !redis)
    throw new Error('Shared auth rate limiting requires the Redis cache driver or an explicit Redis URL.')
  if (redis.url)
    return { url: redis.url, prefix: options.prefix ?? configured.prefix ?? 'stacks' }

  const protocol = redis.tls ? 'rediss' : 'redis'
  const credentials = redis.username
    ? `${encodeURIComponent(redis.username)}:${encodeURIComponent(redis.password ?? '')}@`
    : redis.password
      ? `:${encodeURIComponent(redis.password)}@`
      : ''
  const database = redis.database == null ? '' : `/${redis.database}`
  return {
    url: `${protocol}://${credentials}${redis.host ?? '127.0.0.1'}:${redis.port ?? 6379}${database}`,
    prefix: options.prefix ?? configured.prefix ?? 'stacks',
  }
}

/** Redis-backed store whose Lua update is atomic across workers. */
export class RedisRateLimiterStore implements RateLimiterStore {
  private clientPromise?: Promise<{ client: RedisClient, prefix: string }>

  constructor(private readonly options: RedisRateLimiterStoreOptions = {}) {}

  private async client(): Promise<{ client: RedisClient, prefix: string }> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { cache: configured } = await import('@stacksjs/config')
        const resolved = redisUrl(this.options, configured)
        const client = new RedisClient(resolved.url)
        await client.connect()
        return { client, prefix: resolved.prefix }
      })().catch((error) => {
        this.clientPromise = undefined
        throw error
      })
    }
    return this.clientPromise
  }

  private async key(key: string): Promise<{ client: RedisClient, key: string }> {
    const { client, prefix } = await this.client()
    return { client, key: `${prefix}:auth:ratelimit:${key}` }
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    const resolved = await this.key(key)
    const raw = await resolved.client.get(resolved.key)
    if (raw == null)
      return undefined
    try {
      const entry = JSON.parse(raw) as Partial<RateLimitEntry>
      if (!Number.isSafeInteger(entry.attempts) || entry.attempts! < 0
        || !Number.isSafeInteger(entry.lockedUntil) || entry.lockedUntil! < 0)
        return undefined
      return { attempts: entry.attempts!, lockedUntil: entry.lockedUntil! }
    }
    catch {
      return undefined
    }
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    const resolved = await this.key(key)
    await resolved.client.send('SET', [resolved.key, JSON.stringify(entry), 'PX', String(ttlMs)])
  }

  async delete(key: string): Promise<void> {
    const resolved = await this.key(key)
    await resolved.client.del(resolved.key)
  }

  async recordFailedAttempt(key: string, now: number, ttlMs: number): Promise<void> {
    const resolved = await this.key(key)
    await resolved.client.send('EVAL', [
      RECORD_FAILURE_SCRIPT,
      '1',
      resolved.key,
      String(now),
      String(ttlMs),
      String(MAX_ATTEMPTS),
    ])
  }

  async close(): Promise<void> {
    if (!this.clientPromise)
      return
    const { client } = await this.clientPromise
    client.close()
    this.clientPromise = undefined
  }
}

let store: RateLimiterStore | undefined

function replaceStore(next: RateLimiterStore | undefined): void {
  const previous = store
  store = next
  if (previous && previous !== next && previous.close)
    void Promise.resolve(previous.close()).catch(() => {})
}

async function configuredStore(): Promise<RateLimiterStore> {
  if (store)
    return store
  const { cache } = await import('@stacksjs/config')
  store ??= cache.driver === 'redis' ? new RedisRateLimiterStore() : new MemoryStore()
  return store
}

export class RateLimiter {
  /** Swap the backing store (e.g. a Redis/db-backed shared store). */
  static useStore(custom: RateLimiterStore): void {
    replaceStore(custom)
  }

  /** Use a Redis-backed store with an atomic cross-worker failure update. */
  static useSharedStore(options: RedisRateLimiterStoreOptions = {}): void {
    replaceStore(new RedisRateLimiterStore(options))
  }

  /** Reset to the process-local in-memory store (the default). */
  static useMemoryStore(): void {
    replaceStore(new MemoryStore())
  }

  /** Re-read cache configuration before the next limiter operation. */
  static useConfiguredStore(): void {
    replaceStore(undefined)
  }

  static async isRateLimited(email: string): Promise<boolean> {
    email = email.toLowerCase()

    const now = Date.now()
    const userAttempts = await (await configuredStore()).get(email)

    if (!userAttempts)
      return false

    // A stale read must not delete a lockout renewed by another caller.
    // Stores own TTL eviction; recording a failure resets expired counters.
    return userAttempts.lockedUntil > now
  }

  static async recordFailedAttempt(email: string): Promise<void> {
    email = email.toLowerCase()
    const now = Date.now()
    const active = await configuredStore()
    if (active.recordFailedAttempt) {
      await active.recordFailedAttempt(email, now, LOCKOUT_DURATION)
      return
    }

    // Legacy custom stores retain their existing contract. Shared stores must
    // implement recordFailedAttempt so the update is atomic across workers.
    const entry = recordFailure(await active.get(email), now)
    await active.set(email, entry, LOCKOUT_DURATION)
  }

  static async resetAttempts(email: string): Promise<void> {
    await (await configuredStore()).delete(email.toLowerCase())
  }

  static async validateAttempt(email: string): Promise<void> {
    if (await this.isRateLimited(email))
      throw new HttpError(429, 'Too many login attempts. Please try again later.')
  }
}
