import type { ModelRecord, OnForeignKeyAction } from './schema';
import type { SupportedDialect } from './types';
export declare function buildMigrationPlan(models: ModelRecord, options: InferenceOptions): MigrationPlan;
export declare function generateSql(plan: MigrationPlan, opts?: { dryRun?: boolean }): string[];
/**
 * Helper function to convert SQL statements array to a single string (for backward compatibility)
 */
export declare function generateSqlString(plan: MigrationPlan): string;
/**
 * Helper function to convert diff SQL statements array to a single string (for backward compatibility)
 */
export declare function generateDiffSqlString(previous: MigrationPlan | undefined, next: MigrationPlan): string;
/**
 * Compute a stable hash for a migration plan. Useful for snapshotting.
 */
export declare function hashMigrationPlan(plan: MigrationPlan): string;
/**
 * The dialect's *physical* storage type for a column. Two model types that
 * collapse to the same physical type produce no real schema change, so the
 * diff should ignore the difference. This is what keeps the live-DB
 * introspection path (where the exact model type can't be recovered) from
 * emitting spurious ALTERs on every run.
 *
 * SQLite is the lossy one (string/text/date/datetime/json all map to TEXT;
 * boolean/integer/bigint to INTEGER; float/double/decimal to REAL). For
 * Postgres/MySQL the normalized type round-trips faithfully enough to compare
 * directly.
 */
export declare function canonicalStorageType(col: ColumnPlan, dialect: SupportedDialect): string;
/**
 * Canonical string form of a column default, so equivalent defaults expressed
 * differently by a live DB vs a model (quoting, casts, `now()` vs
 * `CURRENT_TIMESTAMP`, `0` vs `'0'`) compare equal.
 */
export declare function canonicalizeDefault(col: ColumnPlan): string | undefined;
/**
 * Generate comprehensive SQL to migrate from a previous plan to a new plan,
 * plus a structured list of the operations involved (so callers can gate
 * destructive changes and report renames without re-parsing SQL).
 *
 * Handles: created/dropped tables, added/dropped/renamed/modified columns,
 * added/dropped indexes, foreign-key changes, and — on SQLite — table rebuilds
 * for changes the dialect can't do in place.
 *
 * If there is no previous plan or the dialect changed, generates full SQL.
 */
export declare function generateDiffOperations(previous: MigrationPlan | undefined, next: MigrationPlan, opts?: DiffOptions): DiffResult;
/**
 * Generate comprehensive SQL to migrate from a previous plan to a new plan.
 * Thin wrapper over {@link generateDiffOperations} preserved for existing
 * callers that only need the raw statements.
 */
export declare function generateDiffSql(previous: MigrationPlan | undefined, next: MigrationPlan, opts?: DiffOptions): string[];
export declare interface ColumnPlan {
  name: string
  type: NormalizedColumnType
  isPrimaryKey: boolean
  isUnique: boolean
  isNullable: boolean
  hasDefault: boolean
  defaultValue?: PrimitiveDefault
  references?: { table: string, column: string, onDelete?: OnForeignKeyAction, onUpdate?: OnForeignKeyAction }
  enumValues?: string[]
  maxLength?: number
  enumTypeName?: string
}
export declare interface IndexPlan {
  name: string
  columns: string[]
  type: 'index' | 'unique'
  where?: string
}
export declare interface TablePlan {
  table: string
  columns: ColumnPlan[]
  indexes: IndexPlan[]
  shardKey?: string[]
  sortKey?: string[]
  tableKind?: 'rowstore' | 'columnstore' | 'reference'
}
export declare interface MigrationPlan {
  dialect: SupportedDialect
  tables: TablePlan[]
}
/**
 * Inputs for a SQLite table rebuild ("12-step recreate"). SQLite can't
 * `ALTER COLUMN` to change a type, and can't `DROP COLUMN` when the column
 * is a PK / unique / indexed / FK target. The fix is to create a new table
 * with the desired schema, copy data across, drop the old table, and rename
 * the new one into place. See `SQLiteDriver.rebuildTable`.
 */
export declare interface RebuildTableSpec {
  target: TablePlan
  tempName: string
  columnSource: Record<string, string>
}
/**
 * A structured description of one change emitted by the diff engine. Callers
 * (e.g. the Stacks `buddy migrate` command) inspect these to gate destructive
 * changes behind confirmation and to surface rename candidates, instead of
 * re-parsing the raw SQL strings.
 */
export declare interface MigrationOperation {
  kind: MigrationOpKind
  table: string
  column?: string
  from?: string
  to?: string
  destructive: boolean
  confidence?: 'high' | 'low'
  sql: string
}
/** Result of {@link generateDiffOperations}: raw statements + structured ops. */
export declare interface DiffResult {
  statements: string[]
  operations: MigrationOperation[]
}
export declare interface InferenceOptions {
  dialect: SupportedDialect
}
export declare interface DiffOptions {
  applyRenames?: boolean
  dryRun?: boolean
}
export type PrimitiveDefault = string | number | boolean | bigint | Date;
export type NormalizedColumnType = | 'string'
  | 'text'
  | 'boolean'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'double'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'json'
  | 'enum';
/** The kind of schema change a single migration operation represents. */
export type MigrationOpKind = | 'create_table'
  | 'drop_table'
  | 'rename_table'
  | 'add_column'
  | 'drop_column'
  | 'modify_column'
  | 'rename_column'
  | 'create_index'
  | 'drop_index'
  | 'add_foreign_key'
  | 'rebuild_table'
  | 'create_enum';
