import type { ColumnPlan, IndexPlan, RebuildTableSpec, TablePlan } from '../migrations';
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
export declare class MySQLDriver implements DialectDriver {
  protected quoteIdentifier(id: string): string;
  protected getColumnType(column: ColumnPlan): string;
  protected getPrimaryKeyType(column: ColumnPlan): string;
  protected getAutoIncrementClause(column: ColumnPlan): string;
  protected getDefaultValue(column: ColumnPlan): string;
  createEnumType(_enumTypeName: string, _values: string[]): string;
  createTable(table: TablePlan): string;
  createIndex(tableName: string, index: IndexPlan): string;
  addForeignKey(tableName: string, columnName: string, refTable: string, refColumn: string, onDelete?: string, onUpdate?: string): string;
  addColumn(tableName: string, column: ColumnPlan): string;
  modifyColumn(tableName: string, column: ColumnPlan): string;
  renameColumn(tableName: string, from: string, to: string): string;
  renameTable(from: string, to: string): string;
  rebuildTable(): string;
  dropTable(tableName: string): string;
  dropColumn(tableName: string, columnName: string): string;
  dropIndex(tableName: string, indexName: string): string;
  dropEnumType(_enumTypeName: string): string;
  createMigrationsTable(): string;
  getExecutedMigrationsQuery(): string;
  recordMigrationQuery(): string;
  protected renderColumn(column: ColumnPlan): string;
}
