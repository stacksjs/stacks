import type { SupportedDialect } from '../types';
/**
 * Split a SQL script into individual statements, ignoring `;` inside single
 * quotes or `--` line comments. Good enough for our generated DDL.
 */
export declare function splitSqlStatements(sql: string): string[];
/**
 * Derive reverse ("down") DDL from a forward migration's SQL, so a rollback can
 * actually undo schema changes (stacksjs/bun-query-builder#1048). Inverts the
 * statements our generator emits — CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE
 * [UNIQUE] INDEX — in reverse order. Statements it can't safely invert (data
 * changes, complex alters) are skipped; the caller reports them.
 */
export declare function deriveDownStatements(forwardSql: string, dialect?: SupportedDialect): { down: string[], skipped: string[] };
/**
 * Rollback migrations
 *
 * Note: This removes migration entries from the migrations table.
 * Since migrations are auto-generated from models, you should:
 * 1. Revert your model changes
 * 2. Run rollback to remove migration records
 * 3. Generate fresh migrations
 */
export declare function migrateRollback(options?: RollbackOptions): Promise<void>;
export declare interface RollbackOptions {
  steps?: number
  reverseSchema?: boolean
}
