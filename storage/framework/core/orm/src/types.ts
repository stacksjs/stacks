export interface OrmDriver {
  find: (id: number) => Promise<any>
  create: (data: any) => Promise<any>
  update: (id: number, data: any) => Promise<any>
  delete: (id: number) => Promise<any>
  all: () => Promise<any[]>
  where: (column: string, value: any) => Promise<any[]>
  // Custom methods
  // createTable: (tableName: string, callback: (table: Table) => void) => Promise<void>;
  // dropTable: (tableName: string) => Promise<void>; -- i don't think we need this bc we do not support the down method
}
