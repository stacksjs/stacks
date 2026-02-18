import type { Operator } from './subquery'

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

export type SelectedResult<TJson, K extends string> =
  Pick<TJson, Extract<K | 'id', keyof TJson>> & { id: number }

export interface SelectedQuery<TTable, TJson, K extends string> {
  // Chain methods (return self, preserving K)
  where<V = string>(column: keyof TTable, ...args: [V] | [Operator, V]): SelectedQuery<TTable, TJson, K>
  orWhere(...conditions: [keyof TTable, any][]): SelectedQuery<TTable, TJson, K>
  whereIn<V = number>(column: keyof TTable, values: V[]): SelectedQuery<TTable, TJson, K>
  whereNotIn<V = number>(column: keyof TTable, values: V[]): SelectedQuery<TTable, TJson, K>
  whereBetween<V = number>(column: keyof TTable, range: [V, V]): SelectedQuery<TTable, TJson, K>
  whereRef(column: keyof TTable, ...args: string[]): SelectedQuery<TTable, TJson, K>
  when(condition: boolean, callback: (query: SelectedQuery<TTable, TJson, K>) => SelectedQuery<TTable, TJson, K>): SelectedQuery<TTable, TJson, K>
  whereNull(column: keyof TTable): SelectedQuery<TTable, TJson, K>
  whereNotNull(column: keyof TTable): SelectedQuery<TTable, TJson, K>
  whereLike(column: keyof TTable, value: string): SelectedQuery<TTable, TJson, K>
  orderBy(column: keyof TTable, order: 'asc' | 'desc'): SelectedQuery<TTable, TJson, K>
  orderByAsc(column: keyof TTable): SelectedQuery<TTable, TJson, K>
  orderByDesc(column: keyof TTable): SelectedQuery<TTable, TJson, K>
  groupBy(column: keyof TTable): SelectedQuery<TTable, TJson, K>
  having<V = string>(column: keyof TTable, operator: Operator, value: V): SelectedQuery<TTable, TJson, K>
  inRandomOrder(): SelectedQuery<TTable, TJson, K>
  whereColumn(first: keyof TTable, operator: Operator, second: keyof TTable): SelectedQuery<TTable, TJson, K>
  skip(count: number): SelectedQuery<TTable, TJson, K>
  take(count: number): SelectedQuery<TTable, TJson, K>
  distinct(column: keyof TJson): SelectedQuery<TTable, TJson, K>
  join(table: string, firstCol: string, secondCol: string): SelectedQuery<TTable, TJson, K>

  // Terminal methods (return narrowed results)
  first(): Promise<SelectedResult<TJson, K> | undefined>
  last(): Promise<SelectedResult<TJson, K> | undefined>
  firstOrFail(): Promise<SelectedResult<TJson, K>>
  find(id: number): Promise<SelectedResult<TJson, K> | undefined>
  findOrFail(id: number): Promise<SelectedResult<TJson, K>>
  findMany(ids: number[]): Promise<SelectedResult<TJson, K>[]>
  all(): Promise<SelectedResult<TJson, K>[]>
  get(): Promise<SelectedResult<TJson, K>[]>
  latest(column?: keyof TTable): Promise<SelectedResult<TJson, K> | undefined>
  oldest(column?: keyof TTable): Promise<SelectedResult<TJson, K> | undefined>
  paginate(options?: { limit?: number, offset?: number, page?: number }): Promise<{
    data: SelectedResult<TJson, K>[]
    paging: { total_records: number, page: number, total_pages: number }
    next_cursor: number | null
  }>
  chunk(size: number, callback: (models: SelectedResult<TJson, K>[]) => Promise<void>): Promise<void>
  pluck<PK extends Extract<K | 'id', keyof TJson>>(field: PK): Promise<TJson[PK][]>

  // Aggregate methods (unchanged — always return number)
  max(field: keyof TTable): Promise<number>
  min(field: keyof TTable): Promise<number>
  avg(field: keyof TTable): Promise<number>
  sum(field: keyof TTable): Promise<number>
  count(): Promise<number>
}
