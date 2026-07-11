import type { Database } from 'bun:sqlite';
/** The pragma list currently in effect: the config override, or the defaults. */
export declare function resolveSqlitePragmas(): readonly string[];
/**
 * Apply the bootstrap pragmas to a freshly-opened `bun:sqlite` Database.
 *
 * Fail-open per pragma: a single rejected pragma (e.g. a dialect-specific
 * one in a custom list) must not take down connection creation — matching
 * the long-standing behavior of the WAL pragma this generalizes.
 */
export declare function applySqliteBootstrapPragmas(db: Database): void;
/**
 * Bootstrap pragmas applied to every sqlite connection the library opens.
 *
 * SQLite scopes these settings to the CONNECTION, not the database file, and
 * ships with unsafe defaults on every fresh connection: `foreign_keys` is OFF
 * (so `REFERENCES ... ON DELETE CASCADE` in the schema is silently inert and
 * orphan rows insert without error) and there is no busy timeout (concurrent
 * writers surface as immediate `SQLITE_BUSY` failures). They therefore have
 * to be re-applied on every connection the library creates — historically
 * only the query-builder connection got `journal_mode = WAL` while the
 * model-layer executor (the connection `Model.create()/save()/delete()`
 * writes through) got nothing at all, leaving FK enforcement off on the
 * exact connection performing the writes.
 *
 * Override via `setConfig({ sqlite: { pragmas: [...] } })` — the custom list
 * REPLACES this one. Caller-supplied `Database` instances
 * (`configureOrm({ database: db })`) are never touched.
 */
export declare const DEFAULT_SQLITE_PRAGMAS: readonly string[];
