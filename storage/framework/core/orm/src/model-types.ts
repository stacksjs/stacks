import type { RawBuilder } from '@stacksjs/database'
import type { Operator } from './subquery'
import type { SelectedQuery } from './types'

/**
 * QueryMethods contains all shared query builder method signatures.
 * These are identical across all generated models — only the type parameters differ.
 *
 * @template TTable - The table columns type (e.g., PostsTable)
 * @template TJson - The JSON response type (e.g., PostJsonResponse)
 * @template TNew - The insertable type (e.g., NewPost)
 * @template TUpdate - The updateable type (e.g., PostUpdate)
 * @template TRelation - The relation name union (e.g., 'author' | 'tags')
 * @template TSelf - Self-referential type for fluent chaining
 */
export interface QueryMethods<TTable, TJson, TNew, TUpdate, TRelation extends string, TSelf> {
  // Relation loading
  with: (relations: TRelation[]) => TSelf

  // Select
  select: {
    <K extends keyof TTable & string>(fields: K[]): SelectedQuery<TTable, TJson, K>
    (params: RawBuilder<string> | string): TSelf
  }

  // Finders
  find: (id: number) => Promise<TSelf | undefined>
  first: () => Promise<TSelf | undefined>
  last: () => Promise<TSelf | undefined>
  firstOrFail: () => Promise<TSelf | undefined>
  all: () => Promise<TSelf[]>
  findOrFail: (id: number) => Promise<TSelf | undefined>
  findMany: (ids: number[]) => Promise<TSelf[]>
  latest: (column?: keyof TTable) => Promise<TSelf | undefined>
  oldest: (column?: keyof TTable) => Promise<TSelf | undefined>

  // Pagination / Limiting
  skip: (count: number) => TSelf
  take: (count: number) => TSelf

  // Where clauses
  where: <V = string>(column: keyof TTable, ...args: [V] | [Operator, V]) => TSelf
  orWhere: (...conditions: [keyof TTable, any][]) => TSelf
  whereNotIn: <V = number>(column: keyof TTable, values: V[]) => TSelf
  whereBetween: <V = number>(column: keyof TTable, range: [V, V]) => TSelf
  whereRef: (column: keyof TTable, ...args: string[]) => TSelf
  when: (condition: boolean, callback: (query: TSelf) => TSelf) => TSelf
  whereNull: (column: keyof TTable) => TSelf
  whereNotNull: (column: keyof TTable) => TSelf
  whereLike: (column: keyof TTable, value: string) => TSelf
  whereIn: <V = number>(column: keyof TTable, values: V[]) => TSelf

  // Ordering
  orderBy: (column: keyof TTable, order: 'asc' | 'desc') => TSelf
  orderByAsc: (column: keyof TTable) => TSelf
  orderByDesc: (column: keyof TTable) => TSelf

  // Grouping
  groupBy: (column: keyof TTable) => TSelf
  having: <V = string>(column: keyof TTable, operator: Operator, value: V) => TSelf

  // Misc query builders
  inRandomOrder: () => TSelf
  whereColumn: (first: keyof TTable, operator: Operator, second: keyof TTable) => TSelf
  distinct: (column: keyof TJson) => TSelf
  join: (table: string, firstCol: string, secondCol: string) => TSelf

  // Aggregates
  max: (field: keyof TTable) => Promise<number>
  min: (field: keyof TTable) => Promise<number>
  avg: (field: keyof TTable) => Promise<number>
  sum: (field: keyof TTable) => Promise<number>
  count: () => Promise<number>

  // Terminal collection methods
  get: () => Promise<TSelf[]>
  pluck: <K extends keyof TSelf>(field: K) => Promise<TSelf[K][]>
  chunk: (size: number, callback: (models: TSelf[]) => Promise<void>) => Promise<void>
  paginate: (options?: { limit?: number, offset?: number, page?: number }) => Promise<{
    data: TSelf[]
    paging: {
      total_records: number
      page: number
      total_pages: number
    }
    next_cursor: number | null
  }>

  // Mutation methods
  create: (newRecord: TNew) => Promise<TSelf>
  firstOrCreate: (search: Partial<TTable>, values?: TNew) => Promise<TSelf>
  updateOrCreate: (search: Partial<TTable>, values?: TNew) => Promise<TSelf>
  createMany: (newRecords: TNew[]) => Promise<void>
  forceCreate: (newRecord: TNew) => Promise<TSelf>
  remove: (id: number) => Promise<any>

  // Instance methods
  createInstance: (data: TJson) => TSelf
  update: (newRecord: TUpdate) => Promise<TSelf | undefined>
  forceUpdate: (newRecord: TUpdate) => Promise<TSelf | undefined>
  save: () => Promise<TSelf>
  delete: () => Promise<number>
  toSearchableObject: () => Partial<TJson>
  toJSON: () => TJson
  parseResult: (model: TSelf) => TSelf
}

/**
 * BaseModelType = QueryMethods + readonly id.
 * Used in generated type files as the base for each model's exported type.
 *
 * Example usage in generated PostType.ts:
 *   export type PostModelType = BaseModelType<PostsTable, PostJsonResponse, NewPost, PostUpdate, PostRelationName, PostModelType> & {
 *     get title(): string | undefined
 *     set title(value: string)
 *     authorBelong: () => Promise<AuthorModelType>
 *   }
 */
export type BaseModelType<TTable, TJson, TNew, TUpdate, TRelation extends string, TSelf> =
  QueryMethods<TTable, TJson, TNew, TUpdate, TRelation, TSelf> & {
    readonly id: number
  }
