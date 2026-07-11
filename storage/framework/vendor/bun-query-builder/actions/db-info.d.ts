import type { SupportedDialect } from '@/types';
/**
 * Get database information and statistics
 */
export declare function dbInfo(): Promise<DatabaseInfo>;
/**
 * Get database statistics (alias for dbInfo)
 */
export declare function dbStats(): Promise<DatabaseInfo>;
export declare interface TableInfo {
  name: string
  rowCount: number
  columns?: number
  indexes?: number
}
export declare interface DatabaseInfo {
  dialect: SupportedDialect
  database: string
  tables: TableInfo[]
  totalTables: number
  totalRows: number
}
