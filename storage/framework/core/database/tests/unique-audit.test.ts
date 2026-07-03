// stacksjs/stacks#1952 — Unique-index drift audit tests.
//
// Must pin DB_CONNECTION/DB_DATABASE_PATH before importing src/utils:
// the @stacksjs/env proxy reads process.env lazily and getDb() snapshots
// the connection config on first access. Restored in afterAll so the
// override can't leak into sibling test files in the same bun process
// (process-wide setConfig — stacksjs/stacks#1862).

const originalDbConnection = process.env.DB_CONNECTION
const originalDbDatabasePath = process.env.DB_DATABASE_PATH
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = ':memory:'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

// Holds `initializeDbConfig`'s process-wide config mutex for this file's
// entire lifetime (stacksjs/stacks#1862) — acquired first thing below in
// `beforeAll`, released last thing here so a sibling test file's own
// `initializeDbConfig` call can't repoint our connection mid-run.
let releaseDbConfigLock: () => void

afterAll(() => {
  if (originalDbConnection === undefined) delete process.env.DB_CONNECTION
  else process.env.DB_CONNECTION = originalDbConnection
  if (originalDbDatabasePath === undefined) delete process.env.DB_DATABASE_PATH
  else process.env.DB_DATABASE_PATH = originalDbDatabasePath
  releaseDbConfigLock?.()
})

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('../src/utils')
const { auditUniqueIndexes, getDeclaredUniques, getLiveUniqueIndexes } = await import('../src/unique-audit')

beforeAll(async () => {
  releaseDbConfigLock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: ':memory:' } },
    },
  })

  // users: inline column UNIQUE → sqlite_autoindex (origin 'u').
  await db.unsafe('CREATE TABLE ua_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)').execute()
  // teams: explicit CREATE UNIQUE INDEX (origin 'c').
  await db.unsafe('CREATE TABLE ua_teams (id INTEGER PRIMARY KEY, slug TEXT)').execute()
  await db.unsafe('CREATE UNIQUE INDEX ua_teams_slug_unique ON ua_teams (slug)').execute()
  // posts: no unique index at all.
  await db.unsafe('CREATE TABLE ua_posts (id INTEGER PRIMARY KEY, title TEXT)').execute()
  // memberships: a two-column unique index (composite).
  await db.unsafe('CREATE TABLE ua_memberships (id INTEGER PRIMARY KEY, team_id INTEGER, user_id INTEGER)').execute()
  await db.unsafe('CREATE UNIQUE INDEX ua_memberships_team_user_unique ON ua_memberships (team_id, user_id)').execute()
})

describe('getLiveUniqueIndexes (stacksjs/stacks#1952)', () => {
  it('detects both inline-UNIQUE autoindexes and explicit unique indexes', async () => {
    const live = await getLiveUniqueIndexes('sqlite')

    const usersEmail = live.find(i => i.table === 'ua_users' && i.columns.length === 1 && i.columns[0] === 'email')
    expect(usersEmail).toBeDefined()

    const teamsSlug = live.find(i => i.table === 'ua_teams' && i.columns[0] === 'slug')
    expect(teamsSlug).toBeDefined()

    const membership = live.find(i => i.table === 'ua_memberships')
    expect(membership).toBeDefined()
    expect(membership!.columns.sort()).toEqual(['team_id', 'user_id'])
  })
})

describe('auditUniqueIndexes diff logic (stacksjs/stacks#1952)', () => {
  // Build the diff against the live DB seeded above using a hand-rolled
  // declared set, exercising the same matching code path via a small
  // wrapper around getLiveUniqueIndexes.
  async function diff(declared: Array<{ table: string, columns: string[] }>) {
    const live = await getLiveUniqueIndexes('sqlite')
    // Table existence comes from sqlite_master, NOT from having a unique
    // index — mirrors auditUniqueIndexes' getLiveTables gate.
    const tableRows = await db.unsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).execute()
    const liveTables = new Set((Array.isArray(tableRows) ? tableRows : []).map((r: any) => String(r.name).toLowerCase()))
    const liveByTable = new Map<string, Set<string>>()
    for (const idx of live) {
      const t = idx.table.toLowerCase()
      const key = [...idx.columns].map(c => c.toLowerCase()).sort().join(',')
      if (!liveByTable.has(t)) liveByTable.set(t, new Set())
      liveByTable.get(t)!.add(key)
    }
    const missing: typeof declared = []
    const skipped: string[] = []
    for (const d of declared) {
      const t = d.table.toLowerCase()
      if (!liveTables.has(t)) { skipped.push(d.table); continue }
      const key = [...d.columns].map(c => c.toLowerCase()).sort().join(',')
      if (!(liveByTable.get(t)?.has(key) ?? false)) missing.push(d)
    }
    return { missing, skipped }
  }

  it('flags a declared unique on a column with no index as missing', async () => {
    const { missing } = await diff([{ table: 'ua_posts', columns: ['title'] }])
    expect(missing).toHaveLength(1)
    expect(missing[0].table).toBe('ua_posts')
  })

  it('does not flag declared uniques that are indexed (inline or explicit)', async () => {
    const { missing } = await diff([
      { table: 'ua_users', columns: ['email'] },
      { table: 'ua_teams', columns: ['slug'] },
    ])
    expect(missing).toHaveLength(0)
  })

  it('routes a declared unique on a nonexistent table to skippedTables, not missing', async () => {
    const { missing, skipped } = await diff([{ table: 'ua_ghost', columns: ['x'] }])
    expect(missing).toHaveLength(0)
    expect(skipped).toContain('ua_ghost')
  })

  it('matches a composite declared index regardless of column order', async () => {
    const { missing } = await diff([{ table: 'ua_memberships', columns: ['user_id', 'team_id'] }])
    expect(missing).toHaveLength(0)
  })
})

describe('getDeclaredUniques smoke (stacksjs/stacks#1952)', () => {
  it('returns declared uniques without throwing on partial model import', async () => {
    const declared = await getDeclaredUniques()
    expect(Array.isArray(declared)).toBe(true)
    for (const d of declared) {
      expect(Array.isArray(d.columns)).toBe(true)
      expect(d.columns.length).toBeGreaterThan(0)
      expect(['attribute', 'index']).toContain(d.source)
    }
  })

  it('yields a users/email attribute-sourced entry from default models', async () => {
    const declared = await getDeclaredUniques()
    const usersEmail = declared.find(d => d.table === 'users' && d.columns.length === 1 && d.columns[0] === 'email')
    expect(usersEmail).toBeDefined()
    expect(usersEmail!.source).toBe('attribute')
  })
})

describe('auditUniqueIndexes dialect seam (stacksjs/stacks#1952)', () => {
  it('returns supported:false on an unaudited dialect without touching the DB', async () => {
    const result = await auditUniqueIndexes('other' as any)
    expect(result.supported).toBe(false)
    expect(result.declared).toEqual([])
    expect(result.missing).toEqual([])
  })
})

// Direct coverage of the SHIPPED auditUniqueIndexes' missing/skipped
// branches (the diff-logic block above only exercises a hand-rolled copy).
// Drives the real function against the live :memory: DB seeded with real
// default-model table names so getDeclaredUniques()'s `users.email` entry
// is in play.
describe('auditUniqueIndexes shipped missing/skipped branches (stacksjs/stacks#1952)', () => {
  it('flags users.email as missing when the table exists without its unique index', async () => {
    // Real `users` table EXISTS but has NO unique index on email — drift.
    await db.unsafe('DROP TABLE IF EXISTS users').execute()
    await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT)').execute()

    const result = await auditUniqueIndexes('sqlite')
    expect(result.supported).toBe(true)

    const usersEmailMissing = result.missing.find(m => m.table === 'users' && m.columns.length === 1 && m.columns[0] === 'email')
    expect(usersEmailMissing).toBeDefined()
    // Table exists → must NOT be skipped.
    expect(result.skippedTables).not.toContain('users')

    await db.unsafe('DROP TABLE IF EXISTS users').execute()
  })

  it('routes users.email to skippedTables (not missing) when the table was never migrated', async () => {
    // No `users` table at all — declared unique on an unmigrated table.
    await db.unsafe('DROP TABLE IF EXISTS users').execute()

    const result = await auditUniqueIndexes('sqlite')
    expect(result.supported).toBe(true)
    expect(result.skippedTables).toContain('users')
    expect(result.missing.find(m => m.table === 'users')).toBeUndefined()
  })

  it('treats users.email as satisfied (neither missing nor skipped) once the unique index exists', async () => {
    await db.unsafe('DROP TABLE IF EXISTS users').execute()
    await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT)').execute()
    await db.unsafe('CREATE UNIQUE INDEX users_email_unique ON users (email)').execute()

    const result = await auditUniqueIndexes('sqlite')
    expect(result.supported).toBe(true)
    expect(result.missing.find(m => m.table === 'users' && m.columns[0] === 'email')).toBeUndefined()
    expect(result.skippedTables).not.toContain('users')

    await db.unsafe('DROP TABLE IF EXISTS users').execute()
  })
})
