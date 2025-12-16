/**
 * Database types - Compatibility layer
 *
 * These types provide backwards compatibility with code that
 * previously used Kysely types. They work with bun-query-builder's
 * native type system.
 */

/**
 * Marks a column as auto-generated (e.g., auto-increment primary keys).
 * When inserting, this field is optional. When selecting, it's required.
 */
export type Generated<T> = T

/**
 * Marks a column as always generated (computed columns).
 * This field cannot be inserted or updated directly.
 */
export type GeneratedAlways<T> = T

/**
 * Utility type for insert operations.
 * Makes Generated fields optional, keeps required fields required.
 */
export type Insertable<T> = {
  [K in keyof T]?: T[K]
}

/**
 * Utility type for select operations.
 * All fields are as defined in the table type.
 */
export type Selectable<T> = T

/**
 * Utility type for update operations.
 * All fields are optional since you may update only some fields.
 */
export type Updateable<T> = Partial<T>

/**
 * Type for raw SQL expressions.
 * Used when building dynamic SQL queries.
 */
export interface RawBuilder<T = unknown> {
  /** The raw SQL string */
  readonly sql: string
  /** Parameters for the SQL query */
  readonly parameters?: unknown[]
  /** Phantom type for the result */
  readonly __result?: T
}

/**
 * SQL template tag type.
 * Used for tagged template literals that produce SQL.
 */
export interface Sql {
  /** The SQL string */
  readonly sql: string
  /** Parameters for the SQL query */
  readonly parameters: unknown[]
}

/**
 * SQL template tag function.
 * Creates parameterized SQL queries from template literals.
 *
 * @example
 * ```ts
 * const query = sql`SELECT * FROM users WHERE id = ${userId}`
 * ```
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
  const sqlParts: string[] = []
  const parameters: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    sqlParts.push(strings[i] as string)
    if (i < values.length) {
      // Check if the value is a raw SQL expression
      if (values[i] && typeof values[i] === 'object' && 'raw' in (values[i] as object)) {
        sqlParts.push((values[i] as { raw: string }).raw)
      } else {
        sqlParts.push('?')
        parameters.push(values[i])
      }
    }
  }

  return {
    sql: sqlParts.join(''),
    parameters,
  }
}

/**
 * Creates a raw SQL expression that won't be parameterized.
 * Use with caution - only for trusted input!
 *
 * @example
 * ```ts
 * sql`SELECT * FROM users ORDER BY ${sql.raw('created_at DESC')}`
 * ```
 */
sql.raw = function raw(value: string): { raw: string } {
  return { raw: value }
}

/**
 * Reference another column in the query.
 *
 * @example
 * ```ts
 * sql`SELECT * FROM users WHERE updated_at > ${sql.ref('created_at')}`
 * ```
 */
sql.ref = function ref(column: string): { raw: string } {
  return { raw: column }
}

/**
 * Database type alias for backwards compatibility.
 * Use the query builder from bun-query-builder instead.
 */
export type Database = any
