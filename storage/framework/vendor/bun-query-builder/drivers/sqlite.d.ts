import type { ColumnPlan, IndexPlan, RebuildTableSpec, TablePlan } from '../migrations';
/**
 * Whether a plan type belongs to the numeric family. Used by the `_id`
 * safety net (numeric ids must store as INTEGER on SQLite) — non-numeric
 * declared types must never be coerced by the name heuristic.
 */
export declare function isNumericPlanType(type: string | undefined): boolean;
export declare interface DialectDriver {
  createEnumType: (enumTypeName: string, values: string[]) => string
  createTable: (table: TablePlan) => string
  createIndex: (tableName: string, index: IndexPlan) => string
  addForeignKey: (tableName: string, columnName: string, refTable: string, refColumn: string, onDelete?: string, onUpdate?: string) => string
  addColumn: (tableName: string, column: ColumnPlan) => string
  modifyColumn: (tableName: string, column: ColumnPlan) => string
  renameColumn: (tableName: string, from: string, to: string) => string
  renameTable: (from: string, to: string) => string
  rebuildTable: (spec: RebuildTableSpec) => string
  dropTable: (tableName: string) => string
  dropColumn: (tableName: string, columnName: string) => string
  dropIndex: (tableName: string, indexName: string) => string
  dropEnumType: (enumTypeName: string) => string
  createMigrationsTable: () => string
  getExecutedMigrationsQuery: () => string
  recordMigrationQuery: () => string
}
export declare class SQLiteDriver implements DialectDriver {
  createEnumType(_enumTypeName: string, _values: string[]): string;
  createTable(table: TablePlan): string;
  createIndex(tableName: string, index: IndexPlan): string;
  addForeignKey(_tableName: string, _columnName: string, _refTable: string, _refColumn: string, _onDelete?: string, _onUpdate?: string): string;
  addColumn(tableName: string, column: ColumnPlan): string;
  modifyColumn(tableName: string, column: ColumnPlan): string;
  renameColumn(tableName: string, from: string, to: string): string;
  renameTable(from: string, to: string): string;
  rebuildTable(spec: RebuildTableSpec): string;
  dropTable(tableName: string): string;
  dropColumn(tableName: string, columnName: string): string;
  dropIndex(tableName: string, indexName: string): string;
  dropEnumType(_enumTypeName: string): string;
  createMigrationsTable(): string;
  getExecutedMigrationsQuery(): string;
  recordMigrationQuery(): string;
}
