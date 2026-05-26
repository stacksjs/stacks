import type { Operator } from './subquery'
import type { CursorPaginator, Paginator, SimplePaginator } from './paginator'

export interface OrmDriver<T = unknown> {
  find: (id: number) => Promise<T | undefined>
  create: (data: Partial<T>) => Promise<T>
  update: (id: number, data: Partial<T>) => Promise<T | undefined>
  delete: (id: number) => Promise<boolean>
  all: () => Promise<T[]>
  where: (column: string, value: unknown) => Promise<T[]>
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
  /**
   * Paginate with full count metadata (current_page, last_page, total,
   * from, to, has_more_pages). Runs a `COUNT(*)` query in addition to
   * the page query — use {@link simplePaginate} or {@link cursorPaginate}
   * to skip the count on very large tables.
   *
   * P2 (stacksjs/stacks#1906) populates `prev_page_url` / `next_page_url`
   * automatically when a request is in scope.
   *
   * @example
   * ```ts
   * const result = await User.where('active', true).paginate(15, 1)
   * // → { data: User[], current_page: 1, per_page: 15, total: 234,
   * //     last_page: 16, from: 1, to: 15, has_more_pages: true }
   * ```
   */
  paginate(perPage?: number, page?: number): Promise<Paginator<SelectedResult<TJson, K>>>
  /**
   * Paginate without the `COUNT(*)` query — only knows whether more
   * pages exist. Cheaper than {@link paginate} on large tables.
   */
  simplePaginate(perPage?: number, page?: number): Promise<SimplePaginator<SelectedResult<TJson, K>>>
  /**
   * Keyset (cursor) pagination — `WHERE id > :cursor`-style. Constant
   * query cost regardless of how deep the user has paged. No
   * random-access ("jump to page 5") — only prev/next.
   *
   * `column` defaults to `'id'`. Pass an array for composite-key
   * cursors (e.g. `['created_at', 'id']` when ordering by `created_at`
   * needs a tiebreaker on `id`) — the cursor that comes back encodes
   * the tuple via JSON so it survives a URL query-string round-trip,
   * and is decoded on the way back in. `direction` controls the
   * ordering and the comparison operator (`>` for asc, `<` for desc).
   *
   * P2 (stacksjs/stacks#1906) reads `?cursor=` from the active request
   * automatically; pass `null` to force the first page.
   *
   * @example
   * ```ts
   * // single-column cursor, default ORDER BY id ASC
   * const feed = await Post.cursorPaginate(20)
   *
   * // composite cursor, ORDER BY created_at DESC, id DESC
   * const feed = await Post.cursorPaginate(20, null, ['created_at', 'id'], 'desc')
   * ```
   */
  cursorPaginate(
    perPage?: number,
    cursor?: string | number | unknown[] | null,
    column?: keyof TTable | (keyof TTable)[],
    direction?: 'asc' | 'desc',
  ): Promise<CursorPaginator<SelectedResult<TJson, K>>>
  chunk(size: number, callback: (models: SelectedResult<TJson, K>[]) => Promise<void>): Promise<void>
  pluck<PK extends Extract<K | 'id', keyof TJson>>(field: PK): Promise<TJson[PK][]>

  // Aggregate methods (unchanged — always return number)
  max(field: keyof TTable): Promise<number>
  min(field: keyof TTable): Promise<number>
  avg(field: keyof TTable): Promise<number>
  sum(field: keyof TTable): Promise<number>
  count(): Promise<number>
}
