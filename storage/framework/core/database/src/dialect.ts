/**
 * Dialect capability table.
 *
 * Every dialect-conditional branch in the framework used to be an inline
 * string comparison — `driver === 'mysql' || driver === 'singlestore'` in
 * sql-helpers, a second copy in utils' `getDialect()`, a third in
 * driver-config's connection-string switch, a fourth in the migration
 * corpus auditor. Adding a dialect meant finding all of them, and missing
 * one degraded silently: a MySQL-wire dialect that fell through to the
 * SQLite branch emitted `datetime('now')` and `AUTOINCREMENT` at a MySQL
 * server and only failed at execution time.
 *
 * This module is the single place that knows what a dialect can do. The
 * branches above now ask it instead of re-deriving the answer, so a new
 * entry in `CAPABILITIES` is the whole change.
 *
 * The distinction that matters most here is **wire protocol vs. feature
 * set**. Several dialects speak the MySQL wire protocol and share its DML
 * rendering (backtick quoting, `?` placeholders, `LAST_INSERT_ID()`,
 * `ON DUPLICATE KEY UPDATE`) while diverging sharply in what DDL they
 * accept. SingleStore takes MySQL's wire and rejects its foreign keys.
 * Treating "is MySQL" as one boolean is what made that divergence hard to
 * express, so `wire` and the `supports*` flags are tracked separately.
 */

import process from 'node:process'

/**
 * The connection protocol a dialect speaks. Determines placeholder style,
 * identifier quoting, and which connection URL scheme dials it.
 */
export type SqlWireProtocol = 'mysql' | 'postgres' | 'sqlite'

/** SQL catalogue family used by schema audits and migration introspection. */
export type SqlIntrospectionDialect = SqlWireProtocol | 'other'

/**
 * The dialect string handed to bun-query-builder. Several Stacks dialects
 * collapse onto one of these — the query builder only needs to know how to
 * render SQL, and a dialect that is wire- and DML-identical to MySQL wants
 * MySQL's renderer even when Stacks tracks it separately for DDL purposes.
 */
export type QueryBuilderDialect = 'sqlite' | 'mysql' | 'singlestore' | 'vitess' | 'postgres'

export interface DialectCapabilities {
  /** The Stacks-level dialect name, as it appears in `config/database.ts`. */
  dialect: string
  /** Connection protocol. */
  wire: SqlWireProtocol
  /** What bun-query-builder should render for. */
  queryBuilderDialect: QueryBuilderDialect
  /** Default TCP port, absent for embedded dialects. */
  defaultPort?: number
  /** Identifier quoting character used in emitted DDL. */
  identifierQuote: '`' | '"'
  /**
   * Whether `FOREIGN KEY` constraints are accepted. Distributed engines
   * generally reject them because enforcement would need a cross-node read
   * on every write. When false, the migration generator emits the backing
   * index but not the constraint, and referential integrity becomes the
   * application's job.
   */
  supportsForeignKeys: boolean
  /**
   * Whether a server-side auto-increment column is a safe primary key.
   * False on sharded engines, where each shard would hand out the same
   * sequence and collide. Those dialects need an application-generated key
   * (the `useUuid` trait) or an engine-side sequence.
   */
  supportsAutoIncrement: boolean
  /**
   * Whether a transaction spanning multiple tables gets full ACID
   * guarantees. False where a transaction can span shards and degrade to
   * best-effort or two-phase commit.
   */
  supportsAtomicMultiTableTransactions: boolean
  /**
   * Whether schema changes must go through the engine's own online-DDL
   * mechanism rather than being applied over the client connection. When
   * true, the migration runner cannot simply execute the DDL itself.
   */
  requiresOnlineDdl: boolean
  /**
   * Whether `CREATE INDEX IF NOT EXISTS` is accepted. MySQL (and therefore
   * SingleStore) has no such form and raises a syntax error, so an idempotent
   * migration has to emit the bare `CREATE INDEX` there and treat the
   * resulting "Duplicate key name" on replay as success.
   */
  supportsCreateIndexIfNotExists: boolean
}

/**
 * Capability rows.
 *
 * `browser` is intentionally absent: it is a transport shim that proxies to
 * a REST API rather than a SQL dialect, and asking it for a DDL capability
 * is a bug in the caller, not a row to fill in.
 */
const CAPABILITIES: Record<string, DialectCapabilities> = {
  sqlite: {
    dialect: 'sqlite',
    wire: 'sqlite',
    queryBuilderDialect: 'sqlite',
    identifierQuote: '"',
    supportsForeignKeys: true,
    supportsAutoIncrement: true,
    supportsAtomicMultiTableTransactions: true,
    requiresOnlineDdl: false,
    supportsCreateIndexIfNotExists: true,
  },
  mysql: {
    dialect: 'mysql',
    wire: 'mysql',
    queryBuilderDialect: 'mysql',
    defaultPort: 3306,
    identifierQuote: '`',
    supportsForeignKeys: true,
    supportsAutoIncrement: true,
    supportsAtomicMultiTableTransactions: true,
    requiresOnlineDdl: false,
    supportsCreateIndexIfNotExists: false,
  },
  // SingleStore takes MySQL's wire protocol and DML but is a distributed
  // engine: tables carry SHARD KEY / SORT KEY and foreign keys are rejected
  // outright. It keeps AUTO_INCREMENT — SingleStore allocates per-partition
  // ranges from a single aggregator, so values stay unique (they are not
  // gapless, which no caller here depends on).
  singlestore: {
    dialect: 'singlestore',
    wire: 'mysql',
    queryBuilderDialect: 'singlestore',
    defaultPort: 3306,
    identifierQuote: '`',
    supportsForeignKeys: false,
    supportsAutoIncrement: true,
    supportsAtomicMultiTableTransactions: false,
    requiresOnlineDdl: false,
    supportsCreateIndexIfNotExists: false,
  },
  // Vitess is a sharding layer in front of MySQL, reached through vtgate.
  // It speaks MySQL's wire protocol and renders identical DML, which is why
  // it collapses onto the `mysql` renderer rather than needing one of its
  // own — every divergence below is DDL or transactional, not syntactic.
  //
  // The three `false`s are all consequences of one fact, that a keyspace is
  // split across shards that share nothing:
  //   - a foreign key would need a cross-shard read on every write
  //   - AUTO_INCREMENT would hand out the same values on every shard, so
  //     primary keys come from a sequence table in an unsharded keyspace or
  //     from the application (the `useUuid` trait)
  //   - a transaction touching two shards is best-effort or two-phase, not
  //     the single-node ACID the rest of the framework assumes
  //
  // `requiresOnlineDdl` is what stops the migration runner from simply
  // executing DDL over this connection: schema changes go through Vitess's
  // own online-DDL machinery so they can be applied shard by shard without
  // locking the keyspace.
  vitess: {
    dialect: 'vitess',
    wire: 'mysql',
    // Passed through natively (bun-query-builder >= 0.2.6), which routes it
    // to `VitessDriver`. That driver suppresses foreign keys and
    // AUTO_INCREMENT as it GENERATES DDL, while `./ddl-constraints` audits a
    // corpus before it RUNS — the two are complementary, and generation-side
    // guarding is what stops an unusable corpus from being written in the
    // first place. It stays in the MySQL family upstream (`isMysqlLike`), so
    // every DML branch renders exactly as MySQL does.
    queryBuilderDialect: 'vitess',
    // vtgate's MySQL-protocol port, not MySQL's own 3306 — connecting to
    // 3306 on a Vitess cluster reaches a vttablet's underlying mysqld and
    // bypasses the sharding layer completely.
    defaultPort: 15306,
    identifierQuote: '`',
    supportsForeignKeys: false,
    supportsAutoIncrement: false,
    supportsAtomicMultiTableTransactions: false,
    requiresOnlineDdl: true,
    supportsCreateIndexIfNotExists: false,
  },
  postgres: {
    dialect: 'postgres',
    wire: 'postgres',
    queryBuilderDialect: 'postgres',
    defaultPort: 5432,
    identifierQuote: '"',
    supportsForeignKeys: true,
    supportsAutoIncrement: true,
    supportsAtomicMultiTableTransactions: true,
    requiresOnlineDdl: false,
    supportsCreateIndexIfNotExists: true,
  },
}

export interface DialectCapabilityOptions {
  /** Whether the target Vitess keyspace is sharded. */
  vitessSharded?: boolean
}

/**
 * Resolve the Vitess topology from an explicit option or the conventional
 * environment variable. The historical behavior was sharded, so an omitted
 * setting remains conservative and never enables unsupported DDL by accident.
 */
export function isVitessSharded(explicit?: boolean | string): boolean {
  if (typeof explicit === 'boolean')
    return explicit

  const raw = (typeof explicit === 'string' ? explicit : process.env.DB_VITESS_SHARDED)?.trim().toLowerCase()
  if (raw === undefined || raw === '')
    return true
  return !['0', 'false', 'no', 'off'].includes(raw)
}

/**
 * Look up a dialect's capabilities.
 *
 * Unknown dialects resolve to SQLite. That mirrors the fallback every call
 * site already had (`isSqlite = !isPostgres && !isMysql`) and keeps an
 * unrecognized `DB_CONNECTION` value behaving as it did before this module
 * existed, rather than throwing during module load in an app that is merely
 * misconfigured.
 */
export function dialectCapabilities(dialect: string, options: DialectCapabilityOptions = {}): DialectCapabilities {
  const caps = CAPABILITIES[dialect] ?? CAPABILITIES.sqlite as DialectCapabilities
  if (dialect !== 'vitess' || isVitessSharded(options.vitessSharded))
    return caps

  // An unsharded Vitess keyspace is one MySQL shard behind vtgate. It retains
  // MySQL's relational and identity guarantees while still using Vitess's
  // endpoint and native query-builder dialect.
  return {
    ...(CAPABILITIES.mysql as DialectCapabilities),
    dialect: 'vitess',
    queryBuilderDialect: 'vitess',
    defaultPort: 15306,
  }
}

/** Whether the framework has an explicit capability row for this dialect. */
export function isKnownDialect(dialect: string): boolean {
  return dialect in CAPABILITIES
}

/**
 * Collapse a configured database driver to the information-schema family it
 * exposes. Unknown drivers must not inherit SQLite's compatibility fallback:
 * an audit should skip an unknown transport instead of querying the wrong
 * catalogue and reporting false drift.
 */
export function toSqlIntrospectionDialect(dialect: string): SqlIntrospectionDialect {
  if (!isKnownDialect(dialect)) return 'other'
  return dialectCapabilities(dialect).wire
}

/**
 * Render idempotent index DDL for the target dialect. MySQL-compatible
 * servers reject `CREATE INDEX IF NOT EXISTS`; callers execute the bare form
 * there and treat only the duplicate-index error as a successful replay.
 */
export function indexSqlForDialect(statement: string, dialect: string): string {
  if (dialectCapabilities(dialect).supportsCreateIndexIfNotExists)
    return statement
  return statement.replace(/^(\s*CREATE\s+(?:UNIQUE\s+)?INDEX)\s+IF\s+NOT\s+EXISTS\s+/i, '$1 ')
}

/** Whether an error is the expected result of replaying bare MySQL index DDL. */
export function isDuplicateIndexError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /duplicate key name|already exists/i.test(message)
}

/** Every dialect with a capability row, for CLI help and validation messages. */
export function knownDialects(): string[] {
  return Object.keys(CAPABILITIES)
}

/**
 * Whether a dialect speaks the MySQL wire protocol.
 *
 * This is the check that governs SQL *rendering* — placeholders, quoting,
 * `NOW()` vs `datetime('now')`. It deliberately says nothing about DDL
 * feature support; ask `dialectCapabilities()` for that. Conflating the two
 * is what let SingleStore's lack of foreign keys hide behind a `true`.
 */
export function isMysqlWire(dialect: string): boolean {
  return dialectCapabilities(dialect).wire === 'mysql'
}

/** Whether a dialect speaks the PostgreSQL wire protocol. */
export function isPostgresWire(dialect: string): boolean {
  return dialectCapabilities(dialect).wire === 'postgres'
}

/**
 * Collapse a Stacks dialect to the one bun-query-builder renders for.
 *
 * Stacks tracks dialects that the query builder has no separate renderer
 * for, because they differ only in DDL. Passing such a name straight
 * through would make the query builder fall back to its own default and
 * render the wrong SQL, so every path into `setConfig` goes through here.
 */
export function toQueryBuilderDialect(dialect: string): QueryBuilderDialect {
  return dialectCapabilities(dialect).queryBuilderDialect
}
