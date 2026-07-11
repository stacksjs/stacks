import { Database } from 'bun:sqlite';
import { SQL } from 'bun';
import type { PoolConfig } from './types';
export declare function splitSqlStatements(sql: string): string[];
/**
 * Map the qb-level `pool` config (ms-based, ergonomic) onto the Bun SQL
 * driver's native option names (second resolution). Only the knobs Bun's
 * `SQL` actually honors are emitted — `min`/`autoReconnect` are accepted on
 * `PoolConfig` for forward-compatibility but the driver manages them itself,
 * so they are intentionally not passed through. See
 * stacksjs/bun-query-builder#1014.
 */
export declare function resolvePoolOptions(pool?: PoolConfig): {
  max?: number
  idleTimeout?: number
  connectionTimeout?: number
  maxLifetime?: number
};
/**
 * Returns a Bun SQL instance configured for the current dialect and database settings.
 * For SQLite, uses bun:sqlite directly for better compiled binary support.
 * Handles connection errors gracefully by falling back to in-memory SQLite.
 */
export declare function getBunSql(): SQL;
export declare function getOrCreateBunSql(forceNew?: boolean): SQL;
/**
 * Resets the cached database connection.
 * Call this after changing config via setConfig() to ensure the new config is used.
 */
export declare function resetConnection(): void;
// Wrapper that catches "Connection closed" errors and retries with a fresh connection
export declare function withFreshConnection<T>(fn: (sql: SQL) => Promise<T>): Promise<T>;
// Export a lazy proxy - no connection is made until first use
export declare const bunSql: SQL;
/**
 * The query object returned by `connection.unsafe(...)` / a tagged template.
 * Both Bun's native `SQL` query and our `createSQLiteSQL` wrapper satisfy this.
 * See stacksjs/bun-query-builder#1044.
 */
export declare interface DriverQuery {
  execute: () => Promise<any>
  values?: () => any
  raw?: () => any
  toString: () => string
  cancel?: () => void
  readonly sql?: string
  [key: string]: any
}
/**
 * The shared connection surface used across the dispatch path — both the
 * `bun:sqlite` wrapper and Bun's native `SQL` satisfy it. Typing `_sql` against
 * this (instead of `any`) is what lets the ~hundreds of `(_sql as any).unsafe`
 * casts be dropped. See stacksjs/bun-query-builder#1044.
 */
export declare interface DriverConnection {
  (strings: TemplateStringsArray, ...values: any[]): DriverQuery
  (value: any): any
  unsafe: (sql: string, values?: any[]) => AwaitableDriverQuery
  query?: (sql: string, params?: any[]) => any
  close?: () => Promise<void> | void
  _prepareStatement?: (sql: string) => any
  [key: string]: any
}
/** An `unsafe(...)` result: a query object that is ALSO directly awaitable. */
export type AwaitableDriverQuery = DriverQuery & PromiseLike<any>;
/**
 * SQLite wrapper that provides a SQL-like tagged template literal interface
 * using bun:sqlite's Database class for better compiled binary support.
 */
declare class SQLiteWrapper {
  constructor(filename: string);
  query(sql: string, params?: any[]): any[];
  run(sql: string, params?: any[]): any;
  close(): void;
  get database(): Database;
}
// NOTE: this module no longer installs a process-wide `unhandledRejection`
// handler. A library has no business doing so: ANY such listener suppresses the
// runtime's default crash for EVERY unhandled rejection in the consumer's
// process (the old handler's body matched only DB errors but silently swallowed
// the rest), masking genuine production bugs. Expected "database does not exist"
// errors during tests are surfaced/awaited at query time now (#1022); a test
// harness that needs to tolerate a missing DB should install its own handler.
// See stacksjs/bun-query-builder#1040.
// Also export the SQL class for advanced usage
export { SQL } from 'bun';
