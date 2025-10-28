import type { RawBuilder } from '@stacksjs/database'
import type { Operator, SubqueryBuilder } from '@stacksjs/orm'

/**
 * Generic QueryBuilder interface that mimics Laravel's query builder functionality
 * for TypeScript ORM operations.
 *
 * @template T - The table type (e.g., PersonalAccessTokensTable)
 * @template M - The model return type (e.g., AccessTokenModel)
 * @template R - The JSON response type
 */
export interface QueryBuilder<T, M, R = any> {
  /**
   * Adds a basic where clause to the query.
   *
   * @param column - The column to check
   * @param args - Either a single value or an operator and value
   * @returns The model instance for chaining
   */
  where: <V = string>(column: keyof T, ...args: [V] | [Operator, V]) => M

  /**
   * Find a record by its primary key.
   *
   * @param id - The primary key to search for
   * @returns Promise resolving to the model or undefined if not found
   */
  find: (id: number) => Promise<M | undefined>

  /**
   * Execute the query and get the results.
   *
   * @returns Promise resolving to an array of model instances
   */
  get: () => Promise<M[]>

  /**
   * Add an order by clause to the query.
   *
   * @param column - The column to order by
   * @param order - The direction to order (asc or desc)
   * @returns The model instance for chaining
   */
  orderBy: (column: keyof T, order: 'asc' | 'desc') => M

  /**
   * Add a join clause to the query.
   *
   * @param table - The table to join
   * @param firstCol - The first column for join condition
   * @param secondCol - The second column for join condition
   * @returns The model instance for chaining
   */
  join: (table: string, firstCol: string, secondCol: string) => M

  /**
   * Find a record by its primary key or throw an exception if not found.
   *
   * @param id - The primary key to search for
   * @returns Promise resolving to the model
   * @throws ModelNotFoundException if record is not found
   */
  findOrFail: (id: number) => Promise<M>

  /**
   * Adds a where clause with "in" operator to the query.
   *
   * @param column - The column to check
   * @param values - The array of values to check against
   * @returns The model instance for chaining
   */
  whereIn: <V = number>(column: keyof T, values: V[]) => M

  /**
   * Adds a where clause with "not in" operator to the query.
   *
   * @param column - The column to check
   * @param values - The array of values to check against
   * @returns The model instance for chaining
   */
  whereNotIn: <V = number>(column: keyof T, values: V[]) => M

  /**
   * Adds a where clause to check if a column is null.
   *
   * @param column - The column to check
   * @returns The model instance for chaining
   */
  whereNull: (column: keyof T) => M

  /**
   * Adds a where clause to check if a column is not null.
   *
   * @param column - The column to check
   * @returns The model instance for chaining
   */
  whereNotNull: (column: keyof T) => M

  /**
   * Adds a where clause with the "between" operator.
   *
   * @param column - The column to check
   * @param range - The range with min and max values [min, max]
   * @returns The model instance for chaining
   */
  whereBetween: <V = number>(column: keyof T, range: [V, V]) => M

  /**
   * Adds a where clause with a raw SQL condition.
   *
   * @param sqlStatement - The raw SQL statement
   * @returns The model instance for chaining
   */
  whereRaw: (sqlStatement: string) => M

  /**
   * Adds a where clause with the "like" operator.
   *
   * @param column - The column to check
   * @param value - The pattern to match
   * @returns The model instance for chaining
   */
  whereLike: (column: keyof T, value: string) => M

  /**
   * Creates a "where exists" clause with a subquery.
   *
   * @param callback - A callback function to build the subquery
   * @returns The model instance for chaining
   */
  whereExists: (callback: (qb: any) => any) => M

  /**
   * Adds a conditional clause to the query.
   *
   * @param condition - Boolean condition
   * @param callback - Callback function to execute if condition is true
   * @returns The model instance for chaining
   */
  when: (condition: boolean, callback: (query: M) => M) => M

  /**
   * Specify which columns to select in the query.
   *
   * @param params - Array of columns, raw builder or string
   * @returns The model instance for chaining
   */
  select: (params: (keyof R)[] | RawBuilder<string> | string) => M

  /**
   * Get the first record matching the query conditions.
   *
   * @returns Promise resolving to the model or undefined if not found
   */
  first: () => Promise<M | undefined>

  /**
   * Get the first record matching the query conditions or throw an exception.
   *
   * @returns Promise resolving to the model
   * @throws ModelNotFoundException if no records match the query
   */
  firstOrFail: () => Promise<M>

  /**
   * Limit the number of records returned from the query.
   *
   * @param count - Number of records to return
   * @returns The model instance for chaining
   */
  take: (count: number) => M

  /**
   * Skip a specified number of records before retrieving the rest.
   *
   * @param count - Number of records to skip
   * @returns The model instance for chaining
   */
  skip: (count: number) => M

  /**
   * Count the number of records that match the query.
   *
   * @returns Promise resolving to the count
   */
  count: () => Promise<number>

  /**
   * Check if any records exist that match the query.
   *
   * @returns Promise resolving to boolean indicating existence
   */
  exists: () => Promise<boolean>

  /**
   * Add a "with" clause to eager load relationships.
   *
   * @param relations - Array of relationship names to eager load
   * @returns The model instance for chaining
   */
  with: (relations: string[]) => M

  /**
   * Get the maximum value for a specified column.
   *
   * @param field - The field to calculate the maximum value for
   * @returns Promise resolving to the maximum value
   */
  max: (field: keyof T) => Promise<number>

  /**
   * Get the minimum value for a specified column.
   *
   * @param field - The field to calculate the minimum value for
   * @returns Promise resolving to the minimum value
   */
  min: (field: keyof T) => Promise<number>

  /**
   * Process a large result set in chunks.
   *
   * @param size - The number of records per chunk
   * @param callback - Function to process each chunk
   * @returns Promise that resolves when all chunks are processed
   */
  chunk: (size: number, callback: (models: M[]) => Promise<void>) => Promise<void>

  /**
   * Get the average value for a specified column.
   *
   * @param field - The field to calculate the average value for
   * @returns Promise resolving to the average value
   */
  avg: (field: keyof T) => Promise<number>

  /**
   * Get the sum of values for a specified column.
   *
   * @param field - The field to calculate the sum for
   * @returns Promise resolving to the sum
   */
  sum: (field: keyof T) => Promise<number>

  /**
   * Order results in descending order by the specified column.
   *
   * @param column - The column to order by
   * @returns The model instance for chaining
   */
  orderByDesc: (column: keyof T) => M

  /**
   * Order results in ascending order by the specified column.
   *
   * @param column - The column to order by
   * @returns The model instance for chaining
   */
  orderByAsc: (column: keyof T) => M

  /**
   * Get an array containing the values of a given column.
   *
   * @param field - The field to pluck values from
   * @returns Promise resolving to an array of values
   */
  pluck: <K extends keyof M>(field: K) => Promise<M[K][]>

  /**
   * Group results by a column.
   *
   * @param column - The column to group by
   * @returns The model instance for chaining
   */
  groupBy: (column: keyof T) => M

  /**
   * Add a "having" clause to the query.
   *
   * @param column - The column to check
   * @param operator - The comparison operator
   * @param value - The value to compare against
   * @returns The model instance for chaining
   */
  having: <V = string>(column: keyof T, operator: Operator, value: V) => M

  /**
   * Add an "or where" clause to the query.
   *
   * @param conditions - Array of column-value pairs
   * @returns The model instance for chaining
   */
  orWhere: (...conditions: [string, any][]) => M

  /**
   * Filter query by the existence of a relationship.
   *
   * @param relation - The relationship to check
   * @returns The model instance for chaining
   */
  has: (relation: string) => M

  /**
   * Filter query by the existence of a relationship with additional constraints.
   *
   * @param relation - The relationship to check
   * @param callback - Function to add constraints to the relationship query
   * @returns The model instance for chaining
   */
  whereHas: (relation: string, callback: (query: SubqueryBuilder<keyof T>) => void) => M

  /**
   * Filter query by the absence of a relationship.
   *
   * @param relation - The relationship to check
   * @returns The model instance for chaining
   */
  doesntHave: (relation: string) => M

  /**
   * Order the results randomly.
   *
   * @returns The model instance for chaining
   */
  inRandomOrder: () => M

  /**
   * Add a "where column" clause comparing two columns.
   *
   * @param first - The first column
   * @param operator - The comparison operator
   * @param second - The second column
   * @returns The model instance for chaining
   */
  whereColumn: (first: keyof T, operator: Operator, second: keyof T) => M

  /**
   * Get only distinct values from the query.
   *
   * @param column - The column to select distinct values from
   * @returns The model instance for chaining
   */
  distinct: (column: keyof R) => M

  /**
   * Get the latest record ordered by primary key.
   *
   * @returns Promise resolving to the model or undefined if not found
   */
  latest: () => Promise<M | undefined>

  /**
   * Get the oldest record ordered by primary key.
   *
   * @returns Promise resolving to the model or undefined if not found
   */
  oldest: () => Promise<M | undefined>

  /**
   * Get the last record matching the query.
   *
   * @returns Promise resolving to the model or undefined if not found
   */
  last: () => Promise<M | undefined>

  /**
   * Find multiple records by their primary keys.
   *
   * @param ids - Array of primary keys
   * @returns Promise resolving to an array of models
   */
  findMany: (ids: number[]) => Promise<M[]>

  /**
   * Add a reference-based where clause to the query.
   *
   * @param column - The column to check
   * @param args - The operator and reference
   * @returns The model instance for chaining
   */
  whereRef: (column: keyof T, ...args: string[]) => M
}
