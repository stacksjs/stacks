/**
 * Inspect a table's structure, indexes, and statistics
 */
export declare function inspectTable(tableName: string, options?: InspectOptions): Promise<TableInspection>;
/**
 * Alias for inspectTable
 */
export declare function tableInfo(tableName: string, options?: InspectOptions): Promise<TableInspection>;
export declare interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: any
  isPrimaryKey?: boolean
  isForeignKey?: boolean
}
export declare interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}
export declare interface TableInspection {
  tableName: string
  rowCount: number
  columns: ColumnInfo[]
  indexes: IndexInfo[]
}
export declare interface InspectOptions {
  verbose?: boolean
}
