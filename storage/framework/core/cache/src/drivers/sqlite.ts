/**
 * SQLite cache driver.
 *
 * Persists cache entries in a SQLite table, so what an app computes once and
 * can keep - an elevation profile measured by an external service, a rendered
 * fragment - outlives the process. The memory driver loses everything on a
 * restart, which for an app that deploys several times a day meant every
 * deploy paid for every entry again.
 *
 * Point it at the database file the app already keeps across deploys (its
 * own SQLite database is fine: the table is the driver's alone), or at a
 * file of its own. The table is a key/value/expiry triple:
 *
 *   CREATE TABLE stacks_cache (
 *     cache_key   TEXT PRIMARY KEY,
 *     value       TEXT NOT NULL,     -- JSON-serialized
 *     expires_at  INTEGER NULL       -- epoch ms; NULL = never expires
 *   )
 *
 * Values are JSON-serialized on write and parsed on read. TTLs are in seconds
 * (matching the Stacks cache contract); `0`/omitted means "no expiration".
 *
 * Like the SingleStore driver, the class implements the `CacheBackend`
 * surface `StacksCache` consumes, so it inherits stampede protection and tags.
 */

import { Database } from 'bun:sqlite'
import { EventEmitter } from 'node:events'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { escapeLike, likePattern } from '../sql-like'

export interface SqliteCacheOptions {
  /** The SQLite file holding the cache table. `:memory:` for tests. @default 'storage/framework/cache/cache.sqlite' */
  path?: string
  /** Table used to store cache entries. @default 'stacks_cache' */
  table?: string
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

/** Double-quoted identifier for safe interpolation of the configured table name. */
function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`
}

/**
 * Put the file in WAL mode, which lasts with the file, so only its first
 * opener has to. Workers that boot together open a new file together, and
 * SQLite answers every one but the winner of the switch with SQLITE_BUSY at
 * once, without waiting out busy_timeout. By then the winner has switched it,
 * so a loser looks again instead of failing to start.
 */
function useWriteAheadLog(db: Database, waitMs: number): void {
  const deadline = Date.now() + waitMs
  for (;;) {
    try {
      const { journal_mode: mode } = db.query('PRAGMA journal_mode').get() as { journal_mode: string }
      if (mode !== 'wal')
        db.run('PRAGMA journal_mode = WAL')
      return
    }
    catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_BUSY' || Date.now() >= deadline)
        throw error
      Bun.sleepSync(10)
    }
  }
}

export class SqliteCacheStore extends EventEmitter {
  private readonly db: Database
  private readonly qualified: string
  private readonly prefix: string
  private readonly stdTTL: number
  private hits = 0
  private misses = 0

  constructor(options: SqliteCacheOptions = {}) {
    super()
    const path = options.path ?? 'storage/framework/cache/cache.sqlite'
    if (path !== ':memory:' && !path.startsWith('file:'))
      mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    // The app may share the file: wait for its writers rather than failing,
    // and let readers proceed beside a writer.
    this.db.run('PRAGMA busy_timeout = 5000')
    if (path !== ':memory:') useWriteAheadLog(this.db, 5000)
    this.qualified = quoteIdent(options.table ?? 'stacks_cache')
    this.prefix = options.prefix ?? ''
    this.stdTTL = options.stdTTL ?? 0
    this.db.run(`CREATE TABLE IF NOT EXISTS ${this.qualified} (cache_key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER NULL)`)
  }

  private k(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key
  }

  /** Convert a seconds TTL into an absolute epoch-ms expiry (or null). */
  private expiryFor(ttl?: number): number | null {
    const seconds = ttl ?? this.stdTTL
    if (!seconds || seconds <= 0)
      return null
    return Date.now() + seconds * 1000
  }

  async get<T>(key: string): Promise<T | undefined> {
    const row = this.db.query(`SELECT value, expires_at FROM ${this.qualified} WHERE cache_key = ?`).get(this.k(key)) as { value: string, expires_at: number | null } | null
    if (!row) {
      this.misses++
      return undefined
    }
    if (row.expires_at != null && row.expires_at <= Date.now()) {
      // Lazily evict expired entries on read.
      this.db.query(`DELETE FROM ${this.qualified} WHERE cache_key = ?`).run(this.k(key))
      this.misses++
      return undefined
    }
    this.hits++
    return JSON.parse(row.value) as T
  }

  async mget<T>(keys: string[]): Promise<Record<string, T>> {
    const out: Record<string, T> = {}
    for (const key of keys) {
      const value = await this.get<T>(key)
      if (value !== undefined)
        out[key] = value
    }
    return out
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    this.db.query(`INSERT INTO ${this.qualified} (cache_key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`)
      .run(this.k(key), JSON.stringify(value), this.expiryFor(ttl))
    return true
  }

  async mset<T>(entries: Array<{ key: string, value: T, ttl?: number }>): Promise<boolean> {
    this.db.transaction(() => {
      for (const entry of entries)
        this.db.query(`INSERT INTO ${this.qualified} (cache_key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`)
          .run(this.k(entry.key), JSON.stringify(entry.value), this.expiryFor(entry.ttl))
    })()
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
    const list = Array.isArray(keys) ? keys : [keys]
    if (list.length === 0)
      return 0
    const placeholders = list.map(() => '?').join(', ')
    return this.db.query(`DELETE FROM ${this.qualified} WHERE cache_key IN (${placeholders})`).run(...list.map(key => this.k(key))).changes
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined
  }

  async flush(): Promise<void> {
    // Scoped to the prefix when one is configured, so a shared table is not
    // wiped for every namespace. The prefix is matched literally: run through
    // likePattern, a `*` in it was a wildcard and `tenant*` flushed `tenant42`.
    if (this.prefix)
      this.db.query(`DELETE FROM ${this.qualified} WHERE cache_key LIKE ? ESCAPE '\\'`).run(`${escapeLike(this.prefix)}:%`)
    else
      this.db.run(`DELETE FROM ${this.qualified}`)
  }

  async keys(pattern?: string): Promise<string[]> {
    // The prefix is matched literally, the pattern as a `*` glob.
    const like = `${this.prefix ? `${escapeLike(this.prefix)}:` : ''}${pattern ? likePattern(pattern) : '%'}`
    const rows = this.db.query(`SELECT cache_key FROM ${this.qualified} WHERE cache_key LIKE ? ESCAPE '\\' AND (expires_at IS NULL OR expires_at > ?)`).all(like, Date.now()) as Array<{ cache_key: string }>
    const strip = this.prefix ? this.prefix.length + 1 : 0
    return rows.map(row => (strip ? row.cache_key.slice(strip) : row.cache_key))
  }

  async getTtl(key: string): Promise<number | undefined> {
    const row = this.db.query(`SELECT expires_at FROM ${this.qualified} WHERE cache_key = ?`).get(this.k(key)) as { expires_at: number | null } | null
    if (!row)
      return undefined
    // Contract mirrors ts-cache: 0 = no expiration, else the expiry in epoch ms.
    return row.expires_at == null ? 0 : row.expires_at
  }

  async ttl(key: string, ttl: number): Promise<boolean> {
    // SQLite counts rows matched, so an expiry the key already carries is
    // still a key that is there (the SingleStore driver has to ask again).
    return this.db.query(`UPDATE ${this.qualified} SET expires_at = ? WHERE cache_key = ?`).run(this.expiryFor(ttl), this.k(key)).changes > 0
  }

  async take<T>(key: string): Promise<T | undefined> {
    const value = await this.get<T>(key)
    if (value !== undefined)
      await this.del(key)
    return value
  }

  async getStats(): Promise<CacheStatsShape> {
    const row = this.db.query(`SELECT COUNT(*) AS n FROM ${this.qualified} WHERE expires_at IS NULL OR expires_at > ?`).get(Date.now()) as { n: number } | null
    return { hits: this.hits, misses: this.misses, keys: Number(row?.n ?? 0), ksize: 0, vsize: 0 }
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
