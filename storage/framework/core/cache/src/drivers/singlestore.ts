/**
 * SingleStore cache driver.
 *
 * Persists cache entries in a SingleStore rowstore table so a single
 * SingleStore cluster can back both an app's primary data and its cache.
 * SingleStore speaks the MySQL wire protocol, so we connect with Bun's built-in
 * `SQL` over `mysql://` and use `ON DUPLICATE KEY UPDATE` upserts.
 *
 * The table shape is a simple key/value/expiry triple:
 *
 *   CREATE ROWSTORE TABLE stacks_cache (
 *     cache_key   VARCHAR(255) NOT NULL,
 *     value       LONGTEXT NOT NULL,        -- JSON-serialized
 *     expires_at  BIGINT NULL,              -- epoch ms; NULL = never expires
 *     PRIMARY KEY (cache_key)
 *   )
 *
 * Values are JSON-serialized on write and parsed on read. TTLs are in seconds
 * (matching the Stacks cache contract); `0`/omitted means "no expiration".
 *
 * The class implements the subset of `ts-cache`'s `CacheManager` surface that
 * `StacksCache` consumes (get/mget/set/mset/fetch/del/has/flush/keys/getTtl/
 * ttl/take/getStats/close), so it can be dropped into `new StacksCache(store)`
 * and inherit all of the stampede-protection + tag logic for free.
 */

import { SQL } from 'bun'

export interface SingleStoreCacheOptions {
  /** SingleStore host (MySQL wire protocol). @default '127.0.0.1' */
  host?: string
  /** SingleStore port. @default 3306 */
  port?: number
  /** SingleStore username. @default 'root' */
  username?: string
  /** SingleStore password. */
  password?: string
  /** Database holding the cache table. @default 'stacks' */
  database?: string
  /** Table used to store cache entries. @default 'stacks_cache' */
  table?: string
  /** Enable TLS (required by managed SingleStore / Helios). @default false */
  ssl?: boolean
  /** Key prefix for namespacing. */
  prefix?: string
  /** Default TTL in seconds (0 = no expiration). @default 0 */
  stdTTL?: number
}

interface CacheStatsShape {
  hits: number
  misses: number
  keys: number
  ksize: number
  vsize: number
}

/** Backticked identifier for safe interpolation of the configured table name. */
function quoteIdent(id: string): string {
  return `\`${id.replace(/`/g, '``')}\``
}

export class SingleStoreCacheStore {
  private readonly sql: SQL
  private readonly table: string
  private readonly qualified: string
  private readonly prefix: string
  private readonly stdTTL: number
  private ready: Promise<void> | null = null

  private hits = 0
  private misses = 0

  constructor(options: SingleStoreCacheOptions = {}) {
    const {
      host = '127.0.0.1',
      port = 3306,
      username = 'root',
      password = '',
      database = 'stacks',
      table = 'stacks_cache',
      ssl = false,
    } = options

    this.table = table
    this.qualified = quoteIdent(table)
    this.prefix = options.prefix ?? ''
    this.stdTTL = options.stdTTL ?? 0

    const auth = password ? `${username}:${encodeURIComponent(password)}` : username
    const query = ssl ? '?ssl=true' : ''
    this.sql = new SQL(`mysql://${auth}@${host}:${port}/${database}${query}`)
  }

  /** Lazily create the cache table on first use (idempotent). */
  private async ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.sql.unsafe(
        `CREATE ROWSTORE TABLE IF NOT EXISTS ${this.qualified} (`
        + ` cache_key VARCHAR(255) NOT NULL,`
        + ` value LONGTEXT NOT NULL,`
        + ` expires_at BIGINT NULL,`
        + ` PRIMARY KEY (cache_key)`
        + ` )`,
      ).then(() => undefined)
    }
    await this.ready
  }

  private k(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key
  }

  private nowMs(): number {
    return Date.now()
  }

  /** Convert a seconds TTL into an absolute epoch-ms expiry (or null). */
  private expiryFor(ttl?: number): number | null {
    const seconds = ttl ?? this.stdTTL
    if (!seconds || seconds <= 0)
      return null
    return this.nowMs() + seconds * 1000
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensureReady()
    const rows = await this.sql.unsafe(
      `SELECT value, expires_at FROM ${this.qualified} WHERE cache_key = ? LIMIT 1`,
      [this.k(key)],
    ) as Array<{ value: string, expires_at: number | null }>

    const row = rows[0]
    if (!row) {
      this.misses++
      return undefined
    }
    if (row.expires_at != null && row.expires_at <= this.nowMs()) {
      // Lazily evict expired entries on read.
      await this.del(key)
      this.misses++
      return undefined
    }
    this.hits++
    return JSON.parse(row.value) as T
  }

  async mget<T>(keys: string[]): Promise<Record<string, T>> {
    const out: Record<string, T> = {}
    // A single round-trip would be nicer, but per-key keeps expiry eviction
    // and hit/miss accounting consistent with `get`.
    for (const key of keys) {
      const v = await this.get<T>(key)
      if (v !== undefined)
        out[key] = v
    }
    return out
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    await this.ensureReady()
    const expiresAt = this.expiryFor(ttl)
    await this.sql.unsafe(
      `INSERT INTO ${this.qualified} (cache_key, value, expires_at) VALUES (?, ?, ?)`
      + ` ON DUPLICATE KEY UPDATE value = VALUES(value), expires_at = VALUES(expires_at)`,
      [this.k(key), JSON.stringify(value), expiresAt],
    )
    return true
  }

  async mset<T>(entries: Array<{ key: string, value: T, ttl?: number }>): Promise<boolean> {
    for (const e of entries)
      await this.set(e.key, e.value, e.ttl)
    return true
  }

  /** get-or-compute: return the cached value, else run `fn`, store, and return it. */
  async fetch<T>(key: string, fn: () => T | Promise<T>, ttl?: number): Promise<T> {
    const existing = await this.get<T>(key)
    if (existing !== undefined)
      return existing
    const computed = await fn()
    await this.set(key, computed, ttl)
    return computed
  }

  async del(keys: string | string[]): Promise<number> {
    await this.ensureReady()
    const list = Array.isArray(keys) ? keys : [keys]
    if (list.length === 0)
      return 0
    const placeholders = list.map(() => '?').join(', ')
    const result = await this.sql.unsafe(
      `DELETE FROM ${this.qualified} WHERE cache_key IN (${placeholders})`,
      list.map(k => this.k(k)),
    ) as { affectedRows?: number } | Array<unknown>
    // Bun's SQL returns an array for SELECTs and a result object for writes.
    const affected = (result as { affectedRows?: number }).affectedRows
    return typeof affected === 'number' ? affected : list.length
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined
  }

  async flush(): Promise<void> {
    await this.ensureReady()
    // TRUNCATE is the fast path; scope to the prefix when one is configured so
    // a shared cache table isn't wiped for every namespace.
    if (this.prefix) {
      await this.sql.unsafe(
        `DELETE FROM ${this.qualified} WHERE cache_key LIKE ?`,
        [`${this.prefix}:%`],
      )
    }
    else {
      await this.sql.unsafe(`TRUNCATE TABLE ${this.qualified}`)
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    await this.ensureReady()
    // Translate a glob-ish `*` pattern into SQL LIKE. Always constrain to the
    // active prefix so callers only see their own namespace's keys.
    const like = `${this.prefix ? `${this.prefix}:` : ''}${pattern ? pattern.replace(/\*/g, '%') : '%'}`
    const rows = await this.sql.unsafe(
      `SELECT cache_key FROM ${this.qualified} WHERE cache_key LIKE ? AND (expires_at IS NULL OR expires_at > ?)`,
      [like, this.nowMs()],
    ) as Array<{ cache_key: string }>
    const strip = this.prefix ? this.prefix.length + 1 : 0
    return rows.map(r => (strip ? r.cache_key.slice(strip) : r.cache_key))
  }

  async getTtl(key: string): Promise<number | undefined> {
    await this.ensureReady()
    const rows = await this.sql.unsafe(
      `SELECT expires_at FROM ${this.qualified} WHERE cache_key = ? LIMIT 1`,
      [this.k(key)],
    ) as Array<{ expires_at: number | null }>
    const row = rows[0]
    if (!row)
      return undefined
    // Contract mirrors ts-cache: 0 = no expiration, else remaining epoch ms.
    return row.expires_at == null ? 0 : row.expires_at
  }

  async ttl(key: string, ttl: number): Promise<boolean> {
    await this.ensureReady()
    const expiresAt = this.expiryFor(ttl)
    const result = await this.sql.unsafe(
      `UPDATE ${this.qualified} SET expires_at = ? WHERE cache_key = ?`,
      [expiresAt, this.k(key)],
    ) as { affectedRows?: number }
    return (result.affectedRows ?? 0) > 0
  }

  async take<T>(key: string): Promise<T | undefined> {
    const value = await this.get<T>(key)
    if (value !== undefined)
      await this.del(key)
    return value
  }

  async getStats(): Promise<CacheStatsShape> {
    await this.ensureReady()
    const rows = await this.sql.unsafe(
      `SELECT COUNT(*) AS n FROM ${this.qualified} WHERE expires_at IS NULL OR expires_at > ?`,
      [this.nowMs()],
    ) as Array<{ n: number }>
    return {
      hits: this.hits,
      misses: this.misses,
      keys: Number(rows[0]?.n ?? 0),
      ksize: 0,
      vsize: 0,
    }
  }

  async close(): Promise<void> {
    await this.sql.end()
  }
}
