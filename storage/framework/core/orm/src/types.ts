export interface OrmDriver {
  createTable(tableName: string, callback: (table: Table) => void): Promise<void>
  dropTable(tableName: string): Promise<void>
  find(id: number): Promise<any>
}
