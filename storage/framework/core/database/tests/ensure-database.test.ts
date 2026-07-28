// Database bootstrap (`ensure-database.ts`).
//
// Background: `ensureDatabaseExists()` used to switch to the maintenance
// database through bun-query-builder's `setConfig()`. That can never work,
// because bqb's `createConnectionString()` short-circuits on
// `process.env.DB_CONNECTION === dialect` and rebuilds the URL from
// `process.env` (dist/src/index.js: `const envDb = e.DB_DATABASE || ...`).
// The result was the self-contradicting
// `Could not auto-create database "stacks": database "stacks" does not exist`.
//
// Every test here injects both the env proxy and the connection factory, so
// the whole module is exercised without a database server.

import { describe, expect, it } from 'bun:test'
import {
  buildConnectionUrl,
  canCreateDatabases,
  classifyConnectionError,
  createDatabase,
  describeTarget,
  isValidDatabaseIdentifier,
  manualCreateHint,
  probeTargetDatabase,
  quoteIdentifier,
  resolveConnectionTarget,
} from '../src/ensure-database'

const PG_ENV = {
  DB_CONNECTION: 'postgres',
  DB_HOST: '127.0.0.1',
  DB_PORT: 5432,
  DB_DATABASE: 'stacks',
  DB_USERNAME: 'glenn',
  DB_PASSWORD: '',
}

/** A fake Bun SQL client. Records every statement it was asked to run. */
function fakeClient(behaviour: (sql: string) => any) {
  const statements: string[] = []
  const client = {
    unsafe: (sql: string) => {
      statements.push(sql)
      return behaviour(sql)
    },
    close: () => Promise.resolve(),
  }
  return { client, statements }
}

/** Build an error shaped like the ones Bun's Postgres client really throws. */
function pgError(errno: string, message = 'boom') {
  const e: any = new Error(message)
  e.errno = errno
  e.code = 'ERR_POSTGRES_SERVER_ERROR'
  return e
}

function mysqlError(errno: number, message = 'boom') {
  const e: any = new Error(message)
  e.errno = errno
  return e
}

describe('resolveConnectionTarget', () => {
  it('returns null for drivers that need no bootstrap', () => {
    // SQLite creates its file on open; DynamoDB has no SQL catalog; an
    // unknown driver is not ours to guess at.
    expect(resolveConnectionTarget({ DB_CONNECTION: 'sqlite' })).toBeNull()
    expect(resolveConnectionTarget({ DB_CONNECTION: 'dynamodb' })).toBeNull()
    expect(resolveConnectionTarget({ DB_CONNECTION: 'nonsense' })).toBeNull()
    expect(resolveConnectionTarget({})).toBeNull()
  })

  it('resolves a postgres target with the right maintenance candidates', () => {
    const target = resolveConnectionTarget(PG_ENV)!

    expect(target.dialect).toBe('postgres')
    expect(target.driver).toBe('postgres')
    expect(target.database).toBe('stacks')
    expect(target.port).toBe(5432)
    expect(target.username).toBe('glenn')
    // `template1` covers instances where `postgres` was dropped.
    expect(target.maintenanceCandidates).toEqual(['postgres', 'template1'])
  })

  it('strips wrapping quotes the same way bun-query-builder does', () => {
    // bqb strips leading/trailing quotes only (/^['"]|['"]$/g). If we stripped
    // quotes anywhere (the old `.replace(/['"]/g, '')`) we would create one
    // database and then connect to another.
    const target = resolveConnectionTarget({ ...PG_ENV, DB_DATABASE: '\'stacks\'' })!
    expect(target.database).toBe('stacks')
  })

  it('maps singlestore onto the mysql shape instead of :memory:', () => {
    // getConnectionDefaults() has no 'singlestore' branch and falls through to
    // `{ database: ':memory:' }`, which would have produced a nonsense target.
    const target = resolveConnectionTarget({
      DB_CONNECTION: 'singlestore',
      DB_DATABASE: 'shop',
      DB_USERNAME: 'root',
    })!

    expect(target.dialect).toBe('mysql')
    expect(target.driver).toBe('singlestore')
    expect(target.database).toBe('shop')
    expect(target.port).toBe(3306)
    // Managed MySQL often denies the app user any access to `mysql`, but every
    // user can read information_schema, so it is tried first.
    expect(target.maintenanceCandidates).toEqual(['information_schema', 'mysql'])
  })

  it('prefers env over the built-in defaults', () => {
    const target = resolveConnectionTarget({ ...PG_ENV, DB_HOST: 'db.internal', DB_PORT: 6543 })!
    expect(target.host).toBe('db.internal')
    expect(target.port).toBe(6543)
  })
})

describe('classifyConnectionError', () => {
  it('classifies the real Bun postgres error shapes', () => {
    // Captured from Bun's client against a live server, not inferred:
    // errno is a STRING for postgres.
    expect(classifyConnectionError(pgError('3D000', 'database "x" does not exist'))).toBe('missing-database')
    expect(classifyConnectionError(pgError('28000'))).toBe('missing-role')
    expect(classifyConnectionError(pgError('28P01'))).toBe('auth-failed')
    expect(classifyConnectionError(pgError('42501'))).toBe('permission-denied')
  })

  it('classifies a refused socket, which carries no errno at all', () => {
    const e: any = new Error('connection refused')
    e.code = 'ERR_POSTGRES_CONNECTION_REFUSED'
    expect(classifyConnectionError(e)).toBe('server-unreachable')
  })

  it('classifies numeric mysql errnos', () => {
    expect(classifyConnectionError(mysqlError(1049))).toBe('missing-database')
    expect(classifyConnectionError(mysqlError(1045))).toBe('auth-failed')
    expect(classifyConnectionError(mysqlError(1044))).toBe('permission-denied')
    expect(classifyConnectionError(mysqlError(2003))).toBe('server-unreachable')
  })

  it('falls back to message text when no code is present', () => {
    expect(classifyConnectionError(new Error('Unknown database \'shop\''))).toBe('missing-database')
    expect(classifyConnectionError(new Error('role "root" does not exist'))).toBe('missing-role')
    expect(classifyConnectionError(new Error('something else entirely'))).toBe('unknown')
  })
})

describe('isValidDatabaseIdentifier', () => {
  it('accepts ordinary names', () => {
    expect(isValidDatabaseIdentifier('stacks')).toBe(true)
    expect(isValidDatabaseIdentifier('my_app-2')).toBe(true)
  })

  it('rejects anything that could break out of a quoted identifier', () => {
    // We reject rather than normalise, so our name and bqb's stay in lockstep.
    expect(isValidDatabaseIdentifier('sta"cks')).toBe(false)
    expect(isValidDatabaseIdentifier('sta\'cks')).toBe(false)
    expect(isValidDatabaseIdentifier('sta`cks')).toBe(false)
    expect(isValidDatabaseIdentifier('stacks; DROP DATABASE other')).toBe(false)
    expect(isValidDatabaseIdentifier('stacks\\x')).toBe(false)
    expect(isValidDatabaseIdentifier('stacks\nx')).toBe(false)
    expect(isValidDatabaseIdentifier('')).toBe(false)
    expect(isValidDatabaseIdentifier('a'.repeat(64))).toBe(false)
  })
})

describe('quoteIdentifier and buildConnectionUrl', () => {
  it('quotes per dialect', () => {
    expect(quoteIdentifier('postgres', 'stacks')).toBe('"stacks"')
    expect(quoteIdentifier('mysql', 'stacks')).toBe('`stacks`')
  })

  it('builds a url for an arbitrary database on the same server', () => {
    const target = resolveConnectionTarget(PG_ENV)!
    expect(buildConnectionUrl(target, 'postgres')).toBe('postgres://glenn@127.0.0.1:5432/postgres')
  })

  it('url-encodes credentials so a punctuated password cannot corrupt the url', () => {
    const target = resolveConnectionTarget({ ...PG_ENV, DB_PASSWORD: 'p@ss:w/rd' })!
    expect(buildConnectionUrl(target, 'postgres')).toBe('postgres://glenn:p%40ss%3Aw%2Frd@127.0.0.1:5432/postgres')
  })
})

describe('probeTargetDatabase', () => {
  it('probes the TARGET database, not a maintenance database', async () => {
    // Order matters: on a locked-down managed instance the app user often
    // cannot touch `postgres` at all, so leading with maintenance would fail
    // even when the target exists and everything would have worked.
    const urls: string[] = []
    const target = resolveConnectionTarget(PG_ENV)!

    const result = await probeTargetDatabase(target, {
      connect: (url) => {
        urls.push(url)
        return fakeClient(() => Promise.resolve([{ ok: 1 }])).client
      },
    })

    expect(result.ok).toBe(true)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toEndWith('/stacks')
  })

  it('reports a missing database without throwing', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    const result = await probeTargetDatabase(target, {
      connect: () => fakeClient(() => Promise.reject(pgError('3D000'))).client,
    })

    expect(result.ok).toBe(false)
    expect(result.kind).toBe('missing-database')
  })

  it('times out instead of hanging on a silent socket', async () => {
    // A DROPping firewall answers a TCP SYN with silence. Without the bound,
    // the whole migration would stall indefinitely.
    const target = resolveConnectionTarget(PG_ENV)!
    const result = await probeTargetDatabase(target, {
      timeoutMs: 20,
      connect: () => ({ unsafe: () => new Promise(() => {}), close: () => Promise.resolve() }),
    })

    expect(result.ok).toBe(false)
    expect(result.kind).toBe('timeout')
  })

  it('always closes the connection, even when the query throws', async () => {
    let closed = 0
    const target = resolveConnectionTarget(PG_ENV)!
    await probeTargetDatabase(target, {
      connect: () => ({
        unsafe: () => Promise.reject(pgError('3D000')),
        close: () => { closed++; return Promise.resolve() },
      }),
    })

    expect(closed).toBe(1)
  })
})

describe('createDatabase', () => {
  it('issues a properly quoted CREATE DATABASE from a maintenance connection', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    const urls: string[] = []
    const seen = fakeClient(() => Promise.resolve([]))

    const result = await createDatabase(target, {
      connect: (url) => { urls.push(url); return seen.client },
    })

    expect(result.created).toBe(true)
    expect(result.via).toBe('postgres')
    expect(seen.statements).toEqual(['CREATE DATABASE "stacks"'])
    // Connected to the maintenance database, never to the missing target.
    expect(urls[0]).toEndWith('/postgres')
  })

  it('uses IF NOT EXISTS and backticks on mysql', async () => {
    const target = resolveConnectionTarget({ DB_CONNECTION: 'mysql', DB_DATABASE: 'shop', DB_USERNAME: 'root' })!
    const seen = fakeClient(() => Promise.resolve([]))

    await createDatabase(target, { connect: () => seen.client })

    expect(seen.statements).toEqual(['CREATE DATABASE IF NOT EXISTS `shop`'])
  })

  it('refuses an unsafe identifier without opening any connection', async () => {
    const target = resolveConnectionTarget({ ...PG_ENV, DB_DATABASE: 'x"; DROP DATABASE prod; --' })!
    let connections = 0

    const result = await createDatabase(target, {
      connect: () => { connections++; return fakeClient(() => Promise.resolve([])).client },
    })

    expect(result.created).toBe(false)
    expect(connections).toBe(0)
    expect(String((result.error as Error).message)).toContain('Refusing to create')
  })

  it('treats a concurrent winner (42P04) as success, not failure', async () => {
    // Two runners can both see "missing" because the migration lock is taken
    // later. Both proceeding is fine: the database exists, which is all
    // either of them wanted.
    const target = resolveConnectionTarget(PG_ENV)!
    const result = await createDatabase(target, {
      connect: () => fakeClient(() => Promise.reject(pgError('42P04', 'database "stacks" already exists'))).client,
    })

    expect(result.created).toBe(false)
    expect(result.kind).toBeUndefined()
  })

  it('falls through to the next maintenance database when the first is unusable', async () => {
    const target = resolveConnectionTarget({ DB_CONNECTION: 'mysql', DB_DATABASE: 'shop', DB_USERNAME: 'root' })!
    const tried: string[] = []

    const result = await createDatabase(target, {
      connect: (url) => {
        tried.push(url.split('/').pop()!)
        // information_schema is read-only on managed MySQL.
        if (tried.length === 1)
          return fakeClient(() => Promise.reject(mysqlError(1049))).client
        return fakeClient(() => Promise.resolve([])).client
      },
    })

    expect(result.created).toBe(true)
    expect(tried).toEqual(['information_schema', 'mysql'])
  })

  it('stops after a privilege failure instead of rattling every door', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    let attempts = 0

    const result = await createDatabase(target, {
      connect: () => {
        attempts++
        return fakeClient(() => Promise.reject(pgError('42501', 'permission denied to create database'))).client
      },
    })

    expect(result.created).toBe(false)
    expect(result.kind).toBe('permission-denied')
    expect(attempts).toBe(1)
  })
})

describe('canCreateDatabases', () => {
  it('reports false for a role that cannot create databases', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    const allowed = await canCreateDatabases(target, {
      connect: () => fakeClient(() => Promise.resolve([{ rolcreatedb: false, rolsuper: false }])).client,
    })

    expect(allowed).toBe(false)
  })

  it('reports true for a superuser', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    const allowed = await canCreateDatabases(target, {
      connect: () => fakeClient(() => Promise.resolve([{ rolcreatedb: false, rolsuper: true }])).client,
    })

    expect(allowed).toBe(true)
  })

  it('returns null when it cannot tell, so callers still try', async () => {
    const target = resolveConnectionTarget(PG_ENV)!
    const allowed = await canCreateDatabases(target, {
      connect: () => fakeClient(() => Promise.reject(pgError('42501'))).client,
    })

    expect(allowed).toBeNull()
  })

  it('does not guess on mysql, where there is no equivalent lookup', async () => {
    const target = resolveConnectionTarget({ DB_CONNECTION: 'mysql', DB_DATABASE: 'shop' })!
    expect(await canCreateDatabases(target, { connect: () => fakeClient(() => Promise.resolve([])).client })).toBeNull()
  })
})

describe('user-facing copy', () => {
  it('offers a copy-pasteable remediation command', () => {
    const target = resolveConnectionTarget(PG_ENV)!
    expect(manualCreateHint(target)).toBe('createdb -h 127.0.0.1 -p 5432 -U glenn stacks')
  })

  it('describes the target without leaking the password', () => {
    const target = resolveConnectionTarget({ ...PG_ENV, DB_PASSWORD: 'hunter2' })!
    const described = describeTarget(target)

    expect(described).toBe('the postgres connection (127.0.0.1:5432, user "glenn")')
    expect(described).not.toContain('hunter2')
  })

  it('keeps em-dashes out of user-facing strings', () => {
    const target = resolveConnectionTarget(PG_ENV)!
    expect(manualCreateHint(target)).not.toContain('—')
    expect(describeTarget(target)).not.toContain('—')
  })
})
