/**
 * Database bootstrap: does the target database exist, and can we create it?
 *
 * This module deliberately does NOT go through bun-query-builder. bqb's
 * `createConnectionString()` short-circuits whenever
 * `process.env.DB_CONNECTION === dialect` and rebuilds the whole connection
 * string from `process.env`, with `DB_DATABASE` taking precedence over
 * whatever was handed to `setConfig()`. So the old "switch to the admin
 * database via setConfig, then CREATE DATABASE" trick could never work for
 * Postgres or MySQL: it reconnected to the *missing* target database in order
 * to create it, and reported `database "x" does not exist` as the reason it
 * could not create `x`. We open the maintenance connection ourselves with
 * Bun's own SQL client instead, so nothing can rewrite the target underneath
 * us (stacksjs/stacks: `buddy migrate:fresh` on a fresh machine).
 *
 * Everything here is injectable (`EnsureDatabaseDeps.connect`) so the whole
 * module is testable without a database server.
 */

import process from 'node:process'
import { SQL } from 'bun'
import { env as envVars } from '@stacksjs/env'
import { DB_HOST_DEFAULT, DB_NAMES, DB_PORTS, DB_USERS, getConnectionDefaults } from './defaults'

/**
 * A connection we can issue maintenance DDL on. Structurally satisfied by
 * Bun's `SQL` instance; declared here so tests can substitute a fake.
 */
export interface MaintenanceClient {
  unsafe: (sql: string) => any
  close: () => any
}

export type ConnectFn = (url: string) => MaintenanceClient

/**
 * Why a connection attempt failed. Callers branch on this rather than on
 * error message text, which differs per server version and locale.
 */
export type ConnectionFailureKind =
  | 'missing-database'
  | 'missing-role'
  | 'auth-failed'
  | 'server-unreachable'
  | 'permission-denied'
  | 'timeout'
  | 'unknown'

export interface ConnectionTarget {
  /** The engine family used for maintenance DDL. SingleStore speaks MySQL. */
  dialect: 'postgres' | 'mysql'
  /** The raw DB_CONNECTION value, kept for user-facing messages. */
  driver: string
  database: string
  host: string
  port: number
  username: string
  password: string
  /**
   * Databases to try for the maintenance connection, in order. Managed MySQL
   * (RDS, Aurora, PlanetScale) frequently denies the app user any access to
   * `mysql`, so `information_schema` is tried first: every MySQL user can read
   * it. Postgres `template1` covers instances where `postgres` was dropped.
   */
  maintenanceCandidates: string[]
}

export interface ProbeResult {
  ok: boolean
  kind?: ConnectionFailureKind
  error?: unknown
}

export interface EnsureDatabaseDeps {
  connect?: ConnectFn
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Characters that cannot appear in a database name we are about to embed in
 * DDL. We REJECT rather than strip: the old code did
 * `.replace(/['"]/g, '')` (strip anywhere) while bqb does
 * `.replace(/^['"]|['"]$/g, '')` (leading/trailing only), so a name like
 * `sta"cks` normalised to two different strings on the two code paths. That
 * is how you create one database and then connect to another. Rejecting keeps
 * the two in lockstep and closes the DDL-injection hole in one move.
 */
const UNSAFE_IDENTIFIER_CHARS = /["'`\\;\0\n\r]/

/** Postgres caps identifiers at 63 bytes, MySQL at 64. Use the stricter one. */
const MAX_IDENTIFIER_LENGTH = 63

export function isValidDatabaseIdentifier(name: string): boolean {
  if (!name || name.length > MAX_IDENTIFIER_LENGTH)
    return false

  return !UNSAFE_IDENTIFIER_CHARS.test(name)
}

/** Quote an identifier for the dialect. Only ever called after validation. */
export function quoteIdentifier(dialect: 'postgres' | 'mysql', name: string): string {
  return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
}

/**
 * Strip surrounding quotes exactly the way bun-query-builder does
 * (`/^['"]|['"]$/g`), so the name we probe and create is byte-identical to
 * the one bqb will later connect to.
 */
function stripWrappingQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

/**
 * Classify a driver error. The shapes below were captured from Bun's real
 * Postgres client, not inferred: a missing database surfaces
 * `errno: "3D000"` (a STRING) with `code: "ERR_POSTGRES_SERVER_ERROR"`, a
 * missing role `errno: "28000"`, and a refused socket carries no errno at all
 * but `code: "ERR_POSTGRES_CONNECTION_REFUSED"`. MySQL reports numeric errnos,
 * so both types are accepted.
 */
export function classifyConnectionError(error: unknown): ConnectionFailureKind {
  // Narrowed once. Driver errors carry `errno` / `code` / `message` in
  // varying combinations, which is what this function exists to sort out, so
  // each is optional and read defensively below.
  const e = error as { errno?: unknown, code?: unknown, message?: unknown } | null | undefined
  const errno = e?.errno
  const code = typeof e?.code === 'string' ? e.code : ''
  const message = typeof e?.message === 'string' ? e.message : String(error ?? '')

  // Normalise: Postgres SQLSTATEs arrive as strings, MySQL codes as numbers.
  const sqlState = typeof errno === 'string' ? errno.toUpperCase() : ''
  const mysqlErrno = typeof errno === 'number' ? errno : Number.NaN

  // Postgres SQLSTATEs.
  if (sqlState === '3D000')
    return 'missing-database'
  if (sqlState === '28000' || sqlState === '28P01')
    return sqlState === '28P01' ? 'auth-failed' : 'missing-role'
  if (sqlState === '42501')
    return 'permission-denied'

  // MySQL / SingleStore error numbers.
  if (mysqlErrno === 1049)
    return 'missing-database'
  if (mysqlErrno === 1045)
    return 'auth-failed'
  if (mysqlErrno === 1044)
    return 'permission-denied'
  if (mysqlErrno === 2002 || mysqlErrno === 2003)
    return 'server-unreachable'

  if (code.includes('CONNECTION_REFUSED') || code.includes('CONNECTION_CLOSED') || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH')
    return 'server-unreachable'
  if (code === 'ETIMEDOUT' || code.includes('TIMEOUT'))
    return 'timeout'

  // Text fallbacks. Deliberately last: message text is the least stable signal.
  if (/database .* does not exist|unknown database/i.test(message))
    return 'missing-database'
  if (/role .* does not exist|user .* does not exist/i.test(message))
    return 'missing-role'
  if (/password authentication failed|access denied for user/i.test(message))
    return 'auth-failed'
  if (/permission denied|insufficient privilege/i.test(message))
    return 'permission-denied'
  if (/econnrefused|connection refused|can'?t connect/i.test(message))
    return 'server-unreachable'

  return 'unknown'
}

/**
 * Resolve the connection the migration runner will actually use.
 *
 * Precedence mirrors bun-query-builder's `createConnectionString()` exactly
 * (env first, config second), because bqb is what opens the real connection.
 * A config-first resolver here would let us create `foo` while bqb migrates
 * `bar`.
 *
 * Returns `null` when there is nothing to bootstrap: SQLite creates its file
 * on open, DynamoDB has no SQL catalog, and an unknown driver is not ours to
 * guess at.
 */
export function resolveConnectionTarget(envProxy: Record<string, any> = envVars): ConnectionTarget | null {
  const driver = String(envProxy.DB_CONNECTION || 'sqlite')

  if (driver !== 'postgres' && driver !== 'mysql' && driver !== 'singlestore')
    return null

  const dialect: 'postgres' | 'mysql' = driver === 'postgres' ? 'postgres' : 'mysql'

  // getConnectionDefaults() has no 'singlestore' branch and falls through to
  // `{ database: ':memory:' }`, so ask it for the MySQL shape instead.
  const defaults = getConnectionDefaults(dialect, envProxy)

  const database = stripWrappingQuotes(String(envProxy.DB_DATABASE || defaults.database || DB_NAMES.default))
  const host = String(envProxy.DB_HOST || defaults.host || DB_HOST_DEFAULT)
  const port = Number(envProxy.DB_PORT || defaults.port || DB_PORTS[dialect])
  const username = String(envProxy.DB_USERNAME || defaults.username || DB_USERS[dialect])
  const password = String(envProxy.DB_PASSWORD ?? defaults.password ?? '')

  return {
    dialect,
    driver,
    database,
    host,
    port,
    username,
    password,
    maintenanceCandidates: dialect === 'postgres'
      ? ['postgres', 'template1']
      : ['information_schema', 'mysql'],
  }
}

/** Build a connection URL for an arbitrary database on the same server. */
export function buildConnectionUrl(target: ConnectionTarget, database: string): string {
  const scheme = target.dialect === 'postgres' ? 'postgres' : 'mysql'
  const auth = target.password
    ? `${encodeURIComponent(target.username)}:${encodeURIComponent(target.password)}`
    : encodeURIComponent(target.username)
  // Read DB_SSL from the raw env, exactly as bun-query-builder does, so the
  // maintenance connection and the migration connection agree on TLS.
  const sslEnv = process.env.DB_SSL
  const ssl = sslEnv === 'true' || sslEnv === '1' ? '?ssl=true' : ''

  return `${scheme}://${auth}@${target.host}:${target.port}/${encodeURIComponent(database)}${ssl}`
}

/**
 * One connection, not Bun's default pool of 10.
 *
 * Every caller runs a single statement and closes, and one statement needs one
 * session. With the default pool the probe opened 10 server sessions per call
 * against both PostgreSQL 16 and MySQL 8.4 (Bun 1.4.1), and every one of them
 * counts against the server's `max_connections`.
 *
 * It also shrinks, but does not remove, this module's exposure to
 * oven-sh/bun#42804, where a server-side termination races the connections a
 * pool is still opening. Terminating a local PostgreSQL 16 database's sessions
 * while a pool warmed up left a pool of 10 broken in 43 and 76 of 160 trials
 * (two runs) and a pool of 1 in 6 and 6 of 160. A termination while this
 * single connection is still being opened can still leave its close() pending.
 */
function defaultConnect(url: string): MaintenanceClient {
  return new SQL(url, { max: 1 }) as unknown as MaintenanceClient
}

/**
 * Run `work` against `database`, always closing the connection, and never
 * hanging longer than `timeoutMs`. A DROPping firewall answers a TCP SYN with
 * silence, so without this the whole migration would stall indefinitely.
 */
async function withConnection<T>(
  target: ConnectionTarget,
  database: string,
  deps: EnsureDatabaseDeps,
  work: (client: MaintenanceClient) => Promise<T>,
): Promise<T> {
  const connect = deps.connect ?? defaultConnect
  const timeoutMs = deps.timeoutMs ?? Number(process.env.DB_PREFLIGHT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const client = connect(buildConnectionUrl(target, database))

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const e: any = new Error(`Timed out after ${timeoutMs}ms connecting to ${target.dialect} at ${target.host}:${target.port}`)
        e.code = 'ETIMEDOUT'
        reject(e)
      }, timeoutMs)
    })

    return await Promise.race([work(client), timeout])
  }
  finally {
    if (timer)
      clearTimeout(timer)
    // `timeoutMs` bounds `work` only. This close() is outside it and has no
    // limit of its own: when oven-sh/bun#42804 leaves it pending, the caller
    // waits on it (locally still 12 seconds later, past the 10s default).
    // Nothing here bounds that.
    try {
      await client.close()
    }
    catch { /* the connection may already be gone; nothing to salvage */ }
  }
}

/**
 * Probe the TARGET database directly.
 *
 * Order matters: we do not open a maintenance connection first. On a
 * locked-down managed instance the app user often cannot touch `postgres` or
 * `mysql` at all, so leading with maintenance would fail even when the target
 * exists and everything would otherwise have worked.
 */
export async function probeTargetDatabase(
  target: ConnectionTarget,
  deps: EnsureDatabaseDeps = {},
): Promise<ProbeResult> {
  try {
    await withConnection(target, target.database, deps, async client => client.unsafe('select 1'))
    return { ok: true }
  }
  catch (error) {
    return { ok: false, kind: classifyConnectionError(error), error }
  }
}

export interface CreateDatabaseResult {
  created: boolean
  /** Set when creation was attempted and failed. */
  kind?: ConnectionFailureKind
  error?: unknown
  /** The maintenance database that accepted the connection, for diagnostics. */
  via?: string
}

/**
 * Issue `CREATE DATABASE` from a maintenance connection.
 *
 * Ownership note: we authenticate as the same user the app will use, so the
 * new database is owned by that user and no explicit OWNER clause is needed.
 * That matters on PG15+, where a database owned by someone else leaves the app
 * role unable to create tables in `public`.
 */
export async function createDatabase(
  target: ConnectionTarget,
  deps: EnsureDatabaseDeps = {},
): Promise<CreateDatabaseResult> {
  if (!isValidDatabaseIdentifier(target.database)) {
    return {
      created: false,
      kind: 'unknown',
      error: new Error(
        `Refusing to create a database named ${JSON.stringify(target.database)}. `
        + 'Database names must be 1 to 63 characters and may not contain quotes, backslashes, semicolons, or newlines.',
      ),
    }
  }

  const identifier = quoteIdentifier(target.dialect, target.database)
  const sql = target.dialect === 'mysql'
    ? `CREATE DATABASE IF NOT EXISTS ${identifier}`
    : `CREATE DATABASE ${identifier}`

  let lastError: unknown
  let lastKind: ConnectionFailureKind = 'unknown'

  for (const candidate of target.maintenanceCandidates) {
    try {
      await withConnection(target, candidate, deps, async client => client.unsafe(sql))
      return { created: true, via: candidate }
    }
    catch (error) {
      const kind = classifyConnectionError(error)
      const failure = error as { message?: unknown, errno?: unknown } | null | undefined
      const message = failure?.message ?? ''
      const errno = failure?.errno

      // A concurrent runner won the race. Both processes proceeding is fine:
      // the database exists, which is all either of them wanted.
      if (errno === '42P04' || errno === 1007 || /already exists|database exists/i.test(String(message)))
        return { created: false, via: candidate }

      lastError = error
      lastKind = kind

      // A privilege or auth failure will repeat identically on every other
      // maintenance database, so stop rather than rattling the door twice.
      if (kind === 'permission-denied' || kind === 'auth-failed' || kind === 'missing-role')
        break
    }
  }

  return { created: false, kind: lastKind, error: lastError }
}

/**
 * Best-effort check for whether the connected role may create databases.
 * Used to avoid asking a question whose "yes" is guaranteed to fail.
 * Returns `null` when the answer cannot be determined, which callers must
 * treat as "go ahead and try".
 */
export async function canCreateDatabases(
  target: ConnectionTarget,
  deps: EnsureDatabaseDeps = {},
): Promise<boolean | null> {
  if (target.dialect !== 'postgres')
    return null

  for (const candidate of target.maintenanceCandidates) {
    try {
      return await withConnection(target, candidate, deps, async (client) => {
        const rows: any = await client.unsafe(
          'select rolcreatedb, rolsuper from pg_roles where rolname = current_user',
        )
        const row = Array.isArray(rows) ? rows[0] : undefined
        if (!row)
          return null
        return Boolean(row.rolcreatedb || row.rolsuper)
      })
    }
    catch { /* try the next maintenance database */ }
  }

  return null
}

/** Human-readable, copy-pasteable remediation for a failed or declined create. */
export function manualCreateHint(target: ConnectionTarget): string {
  if (target.dialect === 'postgres')
    return `createdb -h ${target.host} -p ${target.port} -U ${target.username} ${target.database}`

  return `mysql -h ${target.host} -P ${target.port} -u ${target.username} -e "CREATE DATABASE \\\`${target.database}\\\`"`
}

/** One-line description of what we are pointed at, for prompts and errors. */
export function describeTarget(target: ConnectionTarget): string {
  return `the ${target.driver} connection (${target.host}:${target.port}, user "${target.username}")`
}
