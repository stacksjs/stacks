import { config } from './config';
import { resetConnection } from './db';
import type { DatabaseSchema } from './schema';
import type { SchemaMeta } from './meta';
/**
 * # `raw`
 *
 * Build a raw SQL fragment for the `*Raw` builder methods (`whereRaw`,
 * `selectRaw`, `orderByRaw`, `groupByRaw`, `havingRaw`) and `select()`.
 *
 * Use this INSTEAD of a Bun `sql\`...\`` tag: a Bun query object cannot be
 * converted back to SQL text (it stringifies to "[object Promise]"), so it
 * silently corrupts the generated SQL. `raw` returns a `{ raw: string }`
 * fragment that the builder renders correctly and that satisfies the
 * `SqlFragment` type (so it passes the bare-string injection guard).
 *
 * Interpolated values in the tagged-template form are SQL-escaped (strings
 * single-quote-doubled, dates → ISO, numbers/booleans/null inlined) — the
 * same escaping the relation-subquery builders use. For user input that must
 * be parameterised, prefer the typed `where(...)` methods over `raw`.
 *
 * @example
 * ```ts
 * import { raw } from 'bun-query-builder'
 * db.selectFrom('users').selectRaw(raw`count(*) as c`)
 * db.selectFrom('users').whereRaw(raw('age > 18'))
 * db.selectFrom('users').orderByRaw(raw`created_at desc`)
 * db.selectFrom('orders').whereRaw(raw`status = ${userStatus}`) // value escaped
 * ```
 */
export declare function raw(strings: TemplateStringsArray | string, ...values: unknown[]): RawExpression;
// eslint-disable-next-line pickier/no-unused-vars
export declare function createQueryBuilder<DB extends DatabaseSchema<any>>(state?: Partial<InternalState>): QueryBuilder<DB>;
/**
 * # `clearQueryCache()`
 *
 * Clears all cached query results.
 *
 * @example
 * ```ts
 * clearQueryCache()
 * ```
 */
export declare function clearQueryCache(): void;
/**
 * # `setQueryCacheMaxSize(size)`
 *
 * Sets the maximum number of cached queries (default 100).
 *
 * @example
 * ```ts
 * setQueryCacheMaxSize(500)
 * ```
 */
export declare function setQueryCacheMaxSize(size: number): void;
// Type guard for raw SQL expressions
declare interface RawExpression {
  raw: string
}
export declare interface WhereRaw {
  raw: any
}
export declare interface BaseSelectQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSelected, TJoined extends string = TTable,> {
  distinct: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  distinctOn: (...columns: (keyof DB[TTable]['columns'] & string | string)[]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  selectRaw: (fragment: SqlFragment) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  where: (expr: WhereExpression<DB[TTable]['columns']> | string, op?: WhereOperator, value?: any) => SelectQueryBuilder<DB, TTable, TSelected>
  whereRaw: (fragment: SqlFragment) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereColumn: (left: string, op: WhereOperator, right: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereColumn: (left: string, op: WhereOperator, right: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereIn: (column: keyof DB[TTable]['columns'] & string, values: any[] | { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereIn: (column: keyof DB[TTable]['columns'] & string, values: any[] | { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNotIn: (column: keyof DB[TTable]['columns'] & string, values: any[] | { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereNotIn: (column: keyof DB[TTable]['columns'] & string, values: any[] | { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereLike: (column: keyof DB[TTable]['columns'] & string, pattern: string, caseSensitive?: boolean) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereILike?: (column: keyof DB[TTable]['columns'] & string, pattern: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereLike: (column: keyof DB[TTable]['columns'] & string, pattern: string, caseSensitive?: boolean) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereILike?: (column: keyof DB[TTable]['columns'] & string, pattern: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNotLike: (column: keyof DB[TTable]['columns'] & string, pattern: string, caseSensitive?: boolean) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNotILike?: (column: keyof DB[TTable]['columns'] & string, pattern: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereNotLike: (column: keyof DB[TTable]['columns'] & string, pattern: string, caseSensitive?: boolean) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereNotILike?: (column: keyof DB[TTable]['columns'] & string, pattern: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereAny: (columns: (keyof DB[TTable]['columns'] & string)[], op: WhereOperator, value: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereAll: (columns: (keyof DB[TTable]['columns'] & string)[], op: WhereOperator, value: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNone: (columns: (keyof DB[TTable]['columns'] & string)[], op: WhereOperator, value: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNested: (fragment: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  orWhereNested: (fragment: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereDate: (column: string, op: WhereOperator, date: string | Date) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereBetween: (column: string, start: any, end: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNotBetween: (column: string, start: any, end: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonContains: (column: string, json: unknown) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonPath?: (path: string, op: WhereOperator, value: unknown) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  andWhere: (expr: WhereExpression<DB[TTable]['columns']> | string, op?: WhereOperator, value?: any) => SelectQueryBuilder<DB, TTable, TSelected>
  orWhere: (expr: WhereExpression<DB[TTable]['columns']> | string, op?: WhereOperator, value?: any) => SelectQueryBuilder<DB, TTable, TSelected>
  orderBy: (column: ColumnName<DB, TTable>, direction?: SortDirection) => SelectQueryBuilder<DB, TTable, TSelected>
  orderByDesc: (column: ColumnName<DB, TTable>) => SelectQueryBuilder<DB, TTable, TSelected>
  inRandomOrder: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  reorder: (column: string, direction?: 'asc' | 'desc') => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  latest: (column?: keyof DB[TTable]['columns'] & string) => SelectQueryBuilder<DB, TTable, TSelected>
  oldest: (column?: keyof DB[TTable]['columns'] & string) => SelectQueryBuilder<DB, TTable, TSelected>
  limit: (n: number) => SelectQueryBuilder<DB, TTable, TSelected>
  offset: (n: number) => SelectQueryBuilder<DB, TTable, TSelected>
  withTimeout?: (ms: number) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  abort?: (signal: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  join: <T2 extends keyof DB & string>(
    table: T2,
    onLeft: JoinColumn<DB, TJoined | T2>,
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like',
    onRight: JoinColumn<DB, TJoined | T2>,
  ) => SelectQueryBuilder<DB, TTable, TSelected, TJoined | T2>
  joinSub: (sub: { toSQL: () => any }, alias: string, onLeft: string, operator: WhereOperator, onRight: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  innerJoin: <T2 extends keyof DB & string>(
    table: T2,
    onLeft: JoinColumn<DB, TJoined | T2>,
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like',
    onRight: JoinColumn<DB, TJoined | T2>,
  ) => SelectQueryBuilder<DB, TTable, TSelected, TJoined | T2>
  leftJoin: <T2 extends keyof DB & string>(
    table: T2,
    onLeft: JoinColumn<DB, TJoined | T2>,
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like',
    onRight: JoinColumn<DB, TJoined | T2>,
  ) => SelectQueryBuilder<DB, TTable, TSelected, TJoined | T2>
  leftJoinSub: (sub: { toSQL: () => any }, alias: string, onLeft: string, operator: WhereOperator, onRight: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  rightJoin: <T2 extends keyof DB & string>(
    table: T2,
    onLeft: JoinColumn<DB, TJoined | T2>,
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like',
    onRight: JoinColumn<DB, TJoined | T2>,
  ) => SelectQueryBuilder<DB, TTable, TSelected, TJoined | T2>
  crossJoin: <T2 extends keyof DB & string>(table: T2) => SelectQueryBuilder<DB, TTable, TSelected, TJoined | T2>
  crossJoinSub: (sub: { toSQL: () => any }, alias: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  groupBy: (...columns: (keyof DB[TTable]['columns'] & string | string)[]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  groupByRaw: (fragment: SqlFragment) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  having: (expr: WhereExpression<any>) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  havingRaw: (fragment: SqlFragment) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  addSelect: (...columns: ((keyof DB[TTable]['columns'] & string) | string | SqlFragment)[]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  select?: {
    <K extends keyof DB[TTable]['columns'] & string>(columns: K[]): SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>, TJoined>
    (columns: string | SqlFragment | (string | SqlFragment)[]): SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  }
  selectAll?: () => SelectQueryBuilder<DB, TTable, DB[TTable]['columns'], TJoined>
  orderByRaw: (fragment: SqlFragment) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  union: (other: { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  unionAll: (other: { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  forPage: (page: number, perPage: number) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  selectAllRelations?: () => SelectQueryBuilder<DB, TTable, any, TJoined>
  whereNull?: (column: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereNotNull?: (column: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereExists?: (subquery: { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonDoesntContain?: (column: string, json: unknown) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonContainsKey?: (path: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonDoesntContainKey?: (path: string) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  whereJsonLength?: (path: string, opOrLen: WhereOperator | number, len?: number) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  with?: (...relations: WithRelationArg<DB, TTable>[]) => SelectQueryBuilder<DB, TTable, TSelected, any>
  whereHas?: (relation: TableRelationName<DB, TTable>, callback?: (qb: any) => any) => SelectQueryBuilder<DB, TTable, TSelected, any>
  whereDoesntHave?: (relation: TableRelationName<DB, TTable>, callback?: (qb: any) => any) => SelectQueryBuilder<DB, TTable, TSelected, any>
  has?: (relation: TableRelationName<DB, TTable>) => SelectQueryBuilder<DB, TTable, TSelected, any>
  doesntHave?: (relation: TableRelationName<DB, TTable>) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withCount?: (...relations: TableRelationName<DB, TTable>[]) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withSum?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withAvg?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withMax?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withMin?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  withPivot?: (relation: TableRelationName<DB, TTable>, ...columns: string[]) => SelectQueryBuilder<DB, TTable, TSelected, any>
  wherePivot?: (relation: TableRelationName<DB, TTable>, column: string, opOrValue: any, value?: any) => SelectQueryBuilder<DB, TTable, TSelected, any>
  wherePivotIn?: (relation: TableRelationName<DB, TTable>, column: string, values: any[]) => SelectQueryBuilder<DB, TTable, TSelected, any>
  wherePivotNotIn?: (relation: TableRelationName<DB, TTable>, column: string, values: any[]) => SelectQueryBuilder<DB, TTable, TSelected, any>
  wherePivotNull?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  wherePivotNotNull?: (relation: TableRelationName<DB, TTable>, column: string) => SelectQueryBuilder<DB, TTable, TSelected, any>
  applyPivotColumns?: () => SelectQueryBuilder<DB, TTable, TSelected, any>
  lockForUpdate: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  sharedLock: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  withCTE: (name: string, sub: { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  withRecursive: (name: string, sub: { toSQL: () => any }) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  value: <K extends keyof TSelected & string>(column: K) => Promise<SelectedRow<DB, TTable, TSelected>[K]>
  pluck: {
    <K extends keyof TSelected & string>(column: K): Promise<SelectedRow<DB, TTable, TSelected>[K][]>
    <K extends keyof TSelected & string, K2 extends keyof TSelected & string>(column: K, key: K2): Promise<Record<string, SelectedRow<DB, TTable, TSelected>[K]>>
  }
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>
  cursorPaginate: (perPage: number, cursor?: string | number, column?: string, direction?: 'asc' | 'desc') => Promise<{ data: SelectedRow<DB, TTable, TSelected>[], meta: { perPage: number, nextCursor: string | number | null } }>
  chunk: (size: number, handler: (rows: any[]) => Promise<void> | void) => Promise<void>
  chunkById: (size: number, column?: string, handler?: (rows: any[]) => Promise<void> | void) => Promise<void>
  eachById: (size: number, column?: string, handler?: (row: any) => Promise<void> | void) => Promise<void>
  when: (condition: any, then: (qb: any) => any, otherwise?: (qb: any) => any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  tap: (fn: (qb: any) => any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  dump: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  dd: () => never
  explain: () => Promise<any[]>
  simple: () => any
  toText?: () => string
  paginate: (perPage: number, page?: number, opts?: { tx?: { unsafe: (sql: string, params?: any[]) => any } }) => Promise<{ data: SelectedRow<DB, TTable, TSelected>[], meta: { perPage: number, page: number, total: number, lastPage: number } }>
  simplePaginate: (perPage: number, page?: number) => Promise<{ data: SelectedRow<DB, TTable, TSelected>[], meta: { perPage: number, page: number, hasMore: boolean } }>
  toSQL: () => string
  execute: () => Promise<SelectedRow<DB, TTable, TSelected>[]>
  executeTakeFirst: () => Promise<SelectedRow<DB, TTable, TSelected> | undefined>
  executeTakeFirstOrThrow: () => Promise<SelectedRow<DB, TTable, TSelected>>
  get: () => Promise<SelectedRow<DB, TTable, TSelected>[]>
  first: () => Promise<SelectedRow<DB, TTable, TSelected> | undefined>
  firstOrFail: () => Promise<SelectedRow<DB, TTable, TSelected>>
  find: (id: any) => Promise<SelectedRow<DB, TTable, TSelected> | undefined>
  findOrFail: (id: any) => Promise<SelectedRow<DB, TTable, TSelected>>
  findMany: (ids: any[]) => Promise<TSelected[]>
  lazy: () => AsyncIterable<TSelected>
  lazyById: () => AsyncIterable<TSelected>
  pipe: <R>(fn: (qb: SelectQueryBuilder<DB, TTable, TSelected, TJoined>) => R) => R
  count: () => Promise<number>
  avg: (column: keyof DB[TTable]['columns'] & string) => Promise<number>
  sum: (column: keyof DB[TTable]['columns'] & string) => Promise<number>
  max: <K extends keyof DB[TTable]['columns'] & string>(column: K) => Promise<DB[TTable]['columns'][K] | null>
  min: <K extends keyof DB[TTable]['columns'] & string>(column: K) => Promise<DB[TTable]['columns'][K] | null>
  readonly rows: TSelected[]
  readonly row: TSelected
  values: () => Promise<any[][]>
  toParams?: () => any[]
  raw: () => Promise<any[][]>
  cancel: () => void
  withTrashed?: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  onlyTrashed?: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  scope?: (name: string, value?: any) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  clone?: () => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  cache?: (ttlMs?: number) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  rowNumber?: (alias?: string, partitionBy?: string | string[], orderBy?: [string, 'asc' | 'desc'][]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  denseRank?: (alias?: string, partitionBy?: string | string[], orderBy?: [string, 'asc' | 'desc'][]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
  rank?: (alias?: string, partitionBy?: string | string[], orderBy?: [string, 'asc' | 'desc'][]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
}
export declare interface InsertQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> {
  values: (data: Partial<DB[TTable]['columns']> | Partial<DB[TTable]['columns']>[]) => InsertQueryBuilder<DB, TTable>
  returning: <K extends keyof DB[TTable]['columns'] & string>(...cols: K[]) => SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>>
  toSQL: () => string
  execute: () => Promise<number | DB[TTable]['columns'] | DB[TTable]['columns'][]>
  returningAll: () => SelectQueryBuilder<DB, TTable, DB[TTable]['columns']>
  executeTakeFirst: () => Promise<DB[TTable]['columns'] | undefined>
  executeTakeFirstOrThrow: () => Promise<DB[TTable]['columns']>
}
export declare interface UpdateQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> {
  set: (values: Partial<DB[TTable]['columns']>) => UpdateQueryBuilder<DB, TTable>
  where: (expr: WhereExpression<DB[TTable]['columns']> | string, op?: WhereOperator, value?: any) => UpdateQueryBuilder<DB, TTable>
  returning: <K extends keyof DB[TTable]['columns'] & string>(...cols: K[]) => SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>>
  toSQL: () => string
  execute: () => Promise<number>
  returningAll: () => SelectQueryBuilder<DB, TTable, DB[TTable]['columns']>
  executeTakeFirst: () => Promise<{ numUpdatedRows?: number }>
  executeTakeFirstOrThrow: () => Promise<{ numUpdatedRows: number }>
}
export declare interface DeleteQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> {
  where: (expr: WhereExpression<DB[TTable]['columns']> | string, op?: WhereOperator, value?: any) => DeleteQueryBuilder<DB, TTable>
  returning: <K extends keyof DB[TTable]['columns'] & string>(...cols: K[]) => SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>>
  toSQL: () => string
  execute: () => Promise<number>
  returningAll: () => SelectQueryBuilder<DB, TTable, DB[TTable]['columns']>
  executeTakeFirst: () => Promise<{ numDeletedRows?: number }>
  executeTakeFirstOrThrow: () => Promise<{ numDeletedRows: number }>
}
export declare interface TableQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> {
  insert: (data: Partial<DB[TTable]['columns']> | Partial<DB[TTable]['columns']>[]) => InsertQueryBuilder<DB, TTable>
  update: (values: Partial<DB[TTable]['columns']>) => UpdateQueryBuilder<DB, TTable>
  delete: () => DeleteQueryBuilder<DB, TTable>
  select: <K extends keyof DB[TTable]['columns'] & string>(...columns: K[]) => SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>>
}
export declare interface QueryBuilder<DB extends DatabaseSchema<any>> {
  select: {
    <TTable extends keyof DB & string, K extends keyof DB[TTable]['columns'] & string>(
      table: TTable,
      ...columns: K[]
    ): SelectQueryBuilder<DB, TTable, Pick<DB[TTable]['columns'], K>>
    <TTable extends keyof DB & string>(
      table: TTable,
      ...columns: ((keyof DB[TTable]['columns'] & string) | `${string} as ${string}`)[]
    ): SelectQueryBuilder<DB, TTable, any>
  }
  selectFrom: <TTable extends keyof DB & string>(table: TTable) => TypedSelectQueryBuilder<DB, TTable, DB[TTable]['columns'], TTable, `SELECT * FROM ${TTable}`>
  insertInto: <TTable extends keyof DB & string>(table: TTable) => TypedInsertQueryBuilder<DB, TTable>
  updateTable: <TTable extends keyof DB & string>(table: TTable) => UpdateQueryBuilder<DB, TTable>
  deleteFrom: <TTable extends keyof DB & string>(table: TTable) => DeleteQueryBuilder<DB, TTable>
  table: <TTable extends keyof DB & string>(table: TTable) => TableQueryBuilder<DB, TTable>
  selectFromSub: (sub: { toSQL: () => any }, alias: string) => SelectQueryBuilder<DB, keyof DB & string, any>
  sql: any
  raw: (strings: TemplateStringsArray, ...values: any[]) => any
  simple: (strings: TemplateStringsArray, ...values: any[]) => any
  unsafe: (query: string, params?: any[]) => Promise<any>
  file: (path: string, params?: any[]) => Promise<any>
  reserve: () => Promise<(QueryBuilder<DB> & { release: () => void })>
  close: (opts?: { timeout?: number }) => Promise<void>
  listen: (channel: string, handler?: (payload: any) => void) => Promise<void>
  unlisten: (channel?: string) => Promise<void>
  notify: (channel: string, payload?: any) => Promise<void>
  copyTo: (queryOrTable: string, options?: Record<string, any>) => Promise<any>
  copyFrom: (queryOrTable: string, source: AsyncIterable<any> | Iterable<any>, options?: Record<string, any>) => Promise<any>
  ping: () => Promise<boolean>
  waitForReady: (opts?: { attempts?: number, delayMs?: number }) => Promise<void>
  transaction: <T>(fn: (tx: QueryBuilder<DB>) => Promise<T> | T, options?: TransactionOptions) => Promise<T>
  savepoint: <T>(fn: (sp: QueryBuilder<DB>) => Promise<T> | T) => Promise<T>
  beginDistributed: <T>(name: string, fn: (tx: QueryBuilder<DB>) => Promise<T> | T) => Promise<T>
  commitDistributed: (name: string) => Promise<void>
  rollbackDistributed: (name: string) => Promise<void>
  configure: (opts: Partial<typeof config>) => QueryBuilder<DB>
  setTransactionDefaults: (defaults: TransactionOptions) => void
  transactional: <TArgs extends any[], R>(fn: (tx: QueryBuilder<DB>, ...args: TArgs) => Promise<R> | R, options?: TransactionOptions) => (...args: TArgs) => Promise<R>
  count: <TTable extends keyof DB & string>(table: TTable, column?: keyof DB[TTable]['columns'] & string) => Promise<number>
  sum: <TTable extends keyof DB & string>(table: TTable, column: keyof DB[TTable]['columns'] & string) => Promise<number>
  avg: <TTable extends keyof DB & string>(table: TTable, column: keyof DB[TTable]['columns'] & string) => Promise<number>
  min: <TTable extends keyof DB & string>(table: TTable, column: keyof DB[TTable]['columns'] & string) => Promise<any>
  max: <TTable extends keyof DB & string>(table: TTable, column: keyof DB[TTable]['columns'] & string) => Promise<any>
  insertOrIgnore: <TTable extends keyof DB & string>(table: TTable, values: Partial<DB[TTable]['columns']> | Partial<DB[TTable]['columns']>[]) => Promise<any>
  insertGetId: <TTable extends keyof DB & string>(table: TTable, values: Partial<DB[TTable]['columns']>, idColumn?: keyof DB[TTable]['columns'] & string) => Promise<any>
  updateOrInsert: <TTable extends keyof DB & string>(table: TTable, match: Partial<DB[TTable]['columns']>, values: Partial<DB[TTable]['columns']>) => Promise<boolean>
  upsert: <TTable extends keyof DB & string>(table: TTable, rows: Partial<DB[TTable]['columns']>[], conflictColumns: (keyof DB[TTable]['columns'] & string)[], mergeColumns?: (keyof DB[TTable]['columns'] & string)[]) => Promise<any>
  create: <TTable extends keyof DB & string>(
    table: TTable,
    values: Partial<DB[TTable]['columns']>,
  ) => Promise<DB[TTable]['columns']>
  createMany: <TTable extends keyof DB & string>(
    table: TTable,
    rows: Partial<DB[TTable]['columns']>[],
  ) => Promise<void>
  insertMany: <TTable extends keyof DB & string>(
    table: TTable,
    rows: Partial<DB[TTable]['columns']>[],
  ) => Promise<void>
  updateMany: <TTable extends keyof DB & string>(
    table: TTable,
    conditions: WhereExpression<DB[TTable]['columns']>,
    data: Partial<DB[TTable]['columns']>,
  ) => Promise<number>
  deleteMany: <TTable extends keyof DB & string>(
    table: TTable,
    ids: any[],
  ) => Promise<number>
  firstOrCreate: <TTable extends keyof DB & string>(
    table: TTable,
    match: Partial<DB[TTable]['columns']>,
    defaults?: Partial<DB[TTable]['columns']>,
  ) => Promise<DB[TTable]['columns']>
  updateOrCreate: <TTable extends keyof DB & string>(
    table: TTable,
    match: Partial<DB[TTable]['columns']>,
    values: Partial<DB[TTable]['columns']>,
  ) => Promise<DB[TTable]['columns']>
  save: <TTable extends keyof DB & string>(
    table: TTable,
    values: Partial<DB[TTable]['columns']>,
  ) => Promise<DB[TTable]['columns']>
  remove: <TTable extends keyof DB & string>(
    table: TTable,
    id: DB[TTable]['columns'][DB[TTable]['primaryKey'] & keyof DB[TTable]['columns']] | any,
  ) => Promise<any>
  find: <TTable extends keyof DB & string>(
    table: TTable,
    id: DB[TTable]['columns'][DB[TTable]['primaryKey'] & keyof DB[TTable]['columns']] | any,
  ) => Promise<DB[TTable]['columns'] | undefined>
  findOrFail: <TTable extends keyof DB & string>(
    table: TTable,
    id: DB[TTable]['columns'][DB[TTable]['primaryKey'] & keyof DB[TTable]['columns']] | any,
  ) => Promise<DB[TTable]['columns']>
  findMany: <TTable extends keyof DB & string>(
    table: TTable,
    ids: any[],
  ) => Promise<DB[TTable]['columns'][]>
  latest: <TTable extends keyof DB & string>(
    table: TTable,
    column?: keyof DB[TTable]['columns'] & string,
  ) => Promise<DB[TTable]['columns'] | undefined>
  oldest: <TTable extends keyof DB & string>(
    table: TTable,
    column?: keyof DB[TTable]['columns'] & string,
  ) => Promise<DB[TTable]['columns'] | undefined>
  skip: <TTable extends keyof DB & string>(
    table: TTable,
    count: number,
  ) => SelectQueryBuilder<DB, TTable, DB[TTable]['columns'], TTable>
  rawQuery: (query: string) => Promise<any>
  id?: (name: string) => any
  ids?: (...names: string[]) => any
  advisoryLock?: (key: number | string) => Promise<void>
  tryAdvisoryLock?: (key: number | string) => Promise<boolean>
  getRelationships?: (table: string) => Record<string, any>
  hasRelationship?: (table: string, relationName: string) => boolean
  getRelationshipType?: (table: string, relationName: string) => string | null
  getRelationshipTarget?: (table: string, relationName: string) => string | null
}
declare interface InternalState {
  sql: any
  meta?: SchemaMeta
  schema?: any
  txDefaults?: TransactionOptions
  inTransaction?: boolean
}
declare interface TxBackoff { baseMs?: number, maxMs?: number, factor?: number, jitter?: boolean }
declare interface TxLoggerEvent { type: 'start' | 'retry' | 'commit' | 'rollback' | 'error', attempt: number, error?: any, durationMs?: number }
export declare interface TransactionOptions {
  retries?: number
  isolation?: TransactionIsolation
  onRetry?: (attempt: number, error: any) => void
  afterCommit?: () => void
  sqlStates?: string[]
  backoff?: TxBackoff
  logger?: (event: TxLoggerEvent) => void
  readOnly?: boolean
  onRollback?: (error: any) => void
  afterRollback?: () => void
}
// Where condition helpers
declare type Primitive = string | number | boolean | bigint | Date | null | undefined;
declare type ValueOrRef = Primitive;
export type WhereOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'in' | 'not in' | 'is' | 'is not';
/**
 * Brand for SQL fragments produced by Bun's `sql\`...\`` tagged-template
 * (or any equivalent helper). Typed as `object` so the *Raw methods
 * (`whereRaw`, `selectRaw`, `groupByRaw`, `havingRaw`, `orderByRaw`)
 * refuse to compile when passed a bare string — concatenated user
 * input (`whereRaw(\`status = '${req.body.s}'\`)`) was the canonical
 * SQL-injection vector flagged by the audit as Q-3.
 *
 * Callers who legitimately need raw SQL use `sql\`...\`` which
 * separates the SQL fragment from parameter values:
 *
 * ```ts
 * import { sql } from 'bun'
 * db.selectFrom('users').whereRaw(sql\`lower(name) = lower(${input})\`)
 * ```
 *
 * The runtime guard in each *Raw method also rejects bare strings as
 * a defense-in-depth backstop for `as any` casts.
 *
 * See stacksjs/stacks#1858 Q-3.
 */
export type SqlFragment = object;
export type WhereExpression<TableColumns> = | Partial<{ [K in keyof TableColumns & string]: ValueOrRef | ValueOrRef[] }>
  | [key: keyof TableColumns & string, op: WhereOperator, value: ValueOrRef | ValueOrRef[]]
  | WhereRaw;
export type QueryResult = any;
/**
 * # `SortDirection`
 *
 * The direction used when ordering query results.
 */
export type SortDirection = 'asc' | 'desc';
/**
 * # `ColumnName<DB, TTable>`
 *
 * Helper type extracting a string union of column names for a given table.
 */
export type ColumnName<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> = keyof DB[TTable]['columns'] & string;
// Named row alias to improve IDE hover readability
export type SelectedRow<DB extends DatabaseSchema<any>, _TTable extends keyof DB & string, TSelected,> = Readonly<TSelected>;
declare type JoinColumn<DB extends DatabaseSchema<any>, TTables extends string> = TTables extends any
  ? `${TTables}.${keyof DB[TTables]['columns'] & string}`
  : never;
/**
 * # `TableRelationName<DB, TTable>`
 *
 * The relation names declared for a table, read from the type-level
 * `relations` map that `DatabaseSchema` carries. Falls back to `string`
 * for hand-written schema types that don't declare relation metadata
 * (inferred `R` is `unknown` when the property is absent), so existing
 * untyped schemas keep compiling. A table that declares ZERO relations
 * yields `never` — every relation name is rejected.
 */
export type TableRelationName<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> = DB[TTable] extends { relations?: infer R }
    ? unknown extends R ? string : keyof NonNullable<R> & string
    : string;
/**
 * # `WithRelationArg<DB, TTable>`
 *
 * Argument accepted by `.with()`: a declared relation name, a dotted nested
 * path rooted at a declared relation (`'posts.comments'`), or a record
 * mapping relation names to constraint callbacks. A table with zero declared
 * relations accepts nothing (the bare `Partial<Record<never, ...>>` would be
 * `{}`, which strings are assignable to — hence the explicit never guard).
 */
export type WithRelationArg<DB extends DatabaseSchema<any>, TTable extends keyof DB & string> = [TableRelationName<DB, TTable>] extends [never]
    ? never
    :
      | TableRelationName<DB, TTable>
      | `${TableRelationName<DB, TTable>}.${string}`
      | Partial<Record<TableRelationName<DB, TTable>, (qb: any) => any>>;
// Convert snake_case to PascalCase at the type level (e.g. created_at -> CreatedAt)
declare type SnakeToPascal<S extends string> = S extends `${infer H}_${infer T}`
  ? `${Capitalize<H>}${SnakeToPascal<T>}`
  : Capitalize<S>;
// Typed SQL builder (type-level only). We piggy-back on the runtime builder but
// thread a phantom TSql string through method signatures so hovers can show the
// composed SQL at compile-time for common operations.
declare type _TypedDynamicWhereMethods<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSelected, TJoined extends string, TSql extends string,> = {
  [K in keyof DB[TTable]['columns'] & string as `where${SnakeToPascal<K>}`]: (
    value: DB[TTable]['columns'][K],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} WHERE ${K} = ?`>
} & {
  [K in keyof DB[TTable]['columns'] & string as `orWhere${SnakeToPascal<K>}`]: (
    value: DB[TTable]['columns'][K],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} OR ${K} = ?`>
} & {
  [K in keyof DB[TTable]['columns'] & string as `andWhere${SnakeToPascal<K>}`]: (
    value: DB[TTable]['columns'][K],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} AND ${K} = ?`>
}
// NOTE: TypedSelectQueryBuilder must NOT also intersect DynamicWhereMethods —
// _TypedDynamicWhereMethods declares the same `where<Column>` keys, and the
// untyped variant (returning a plain SelectQueryBuilder) would win overload
// resolution, silently downgrading `toSQL()` from the composed literal SQL
// type back to `string` after any dynamic-where call.
export type TypedSelectQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSelected, TJoined extends string = TTable, TSql extends string = `SELECT * FROM ${TTable}`,> = Omit<
  BaseSelectQueryBuilder<DB, TTable, TSelected, TJoined>,
  'toSQL' | 'where' | 'andWhere' | 'orWhere' | 'orderBy' | 'limit'
> & _TypedDynamicWhereMethods<DB, TTable, TSelected, TJoined, TSql>
& {
  toSQL: () => TSql
  where: (<K extends keyof DB[TTable]['columns'] & string>(
    expr: Record<K, DB[TTable]['columns'][K]>,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} WHERE ${K} = ?`>) & (<K extends keyof DB[TTable]['columns'] & string, OP extends WhereOperator>(
    expr: [K, OP, any],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} WHERE ${K} ${Uppercase<OP>} ${OP extends 'in' | 'not in' ? '(?)' : '?'}`>) & ((
    expr: WhereExpression<DB[TTable]['columns']> | string,
    op?: WhereOperator,
    value?: any,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} WHERE ${string}`>)
  andWhere: (<K extends keyof DB[TTable]['columns'] & string>(
    expr: Record<K, DB[TTable]['columns'][K]>,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} AND ${K} = ?`>) & (<K extends keyof DB[TTable]['columns'] & string, OP extends WhereOperator>(
    expr: [K, OP, any],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} AND ${K} ${Uppercase<OP>} ${OP extends 'in' | 'not in' ? '(?)' : '?'}`>) & ((
    expr: WhereExpression<DB[TTable]['columns']> | string,
    op?: WhereOperator,
    value?: any,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} AND ${string}`>)
  orWhere: (<K extends keyof DB[TTable]['columns'] & string>(
    expr: Record<K, DB[TTable]['columns'][K]>,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} OR ${K} = ?`>) & (<K extends keyof DB[TTable]['columns'] & string, OP extends WhereOperator>(
    expr: [K, OP, any],
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} OR ${K} ${Uppercase<OP>} ${OP extends 'in' | 'not in' ? '(?)' : '?'}`>) & ((
    expr: WhereExpression<DB[TTable]['columns']> | string,
    op?: WhereOperator,
    value?: any,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} OR ${string}`>)
  orderBy: <C extends keyof DB[TTable]['columns'] & string, D extends 'asc' | 'desc' = 'asc'>(
    column: C,
    direction?: D,
  ) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} ORDER BY ${C} ${D}`>
  limit: <N extends number>(n: N) => TypedSelectQueryBuilder<DB, TTable, TSelected, TJoined, `${TSql} LIMIT ${N}`>
}
declare type DynamicWhereMethods<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSelected, TJoined extends string = TTable,> = {
  [K in keyof DB[TTable]['columns'] & string as `where${SnakeToPascal<K>}`]: (value: DB[TTable]['columns'][K]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
} & {
  [K in keyof DB[TTable]['columns'] & string as `orWhere${SnakeToPascal<K>}`]: (value: DB[TTable]['columns'][K]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
} & {
  [K in keyof DB[TTable]['columns'] & string as `andWhere${SnakeToPascal<K>}`]: (value: DB[TTable]['columns'][K]) => SelectQueryBuilder<DB, TTable, TSelected, TJoined>
}
export type SelectQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSelected, TJoined extends string = TTable,> = BaseSelectQueryBuilder<DB, TTable, TSelected, TJoined> & DynamicWhereMethods<DB, TTable, TSelected, TJoined>;
// Typed INSERT builder to expose a structured SQL literal in hovers
export type TypedInsertQueryBuilder<DB extends DatabaseSchema<any>, TTable extends keyof DB & string, TSql extends string = `INSERT INTO ${TTable}`,> = Omit<InsertQueryBuilder<DB, TTable>, 'toSQL' | 'values' | 'returning'> & {
  toSQL: () => TSql
  values: (
    data: Partial<DB[TTable]['columns']> | Partial<DB[TTable]['columns']>[],
  ) => TypedInsertQueryBuilder<DB, TTable, `${TSql} ${string}`>
  returning: <K extends keyof DB[TTable]['columns'] & string>(
    ...cols: K[]
  ) => TypedSelectQueryBuilder<
    DB,
    TTable,
    Pick<DB[TTable]['columns'], K>,
    TTable,
    `${TSql} RETURNING ${string}`
  >
}
declare type TransactionIsolation = 'read committed' | 'repeatable read' | 'serializable';
declare class QueryCache {
  get(key: string): any | null;
  set(key: string, data: any, ttlMs: number): void;
  clear(): void;
  setMaxSize(size: number): void;
}
export { resetConnection };
