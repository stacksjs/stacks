/**
 * Export data from a table
 */
// eslint-disable-next-line pickier/no-unused-vars
export declare function exportData(tableName: string, options?: ExportOptions): Promise<void>;
/**
 * Import data into a table
 */
export declare function importData(tableName: string, filePath: string, options?: ImportOptions): Promise<void>;
/**
 * Dump database or specific tables to SQL
 */
export declare function dumpDatabase(options?: DumpOptions): Promise<void>;
export declare interface ExportOptions {
  format?: 'json' | 'csv' | 'sql'
  output?: string
  limit?: number
}
export declare interface ImportOptions {
  format?: 'json' | 'csv'
  truncate?: boolean
}
export declare interface DumpOptions {
  tables?: string
  output?: string
}
