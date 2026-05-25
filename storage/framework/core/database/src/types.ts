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

/**
 * Comparison operator accepted by {@link StacksExpressionBuilder.cmpr}
 * and friends. Mirrors the standard SQL operators the underlying
 * Kysely-style builder supports.
 */
export type ExpressionOperator =
  | '=' | '!=' | '<>' | '<' | '<=' | '>' | '>='
  | 'in' | 'not in' | 'is' | 'is not'
  | 'like' | 'not like' | 'ilike' | 'not ilike'

/**
 * Reference to a column for use inside an expression. Returned by
 * {@link StacksExpressionBuilder.ref} and accepted everywhere a value
 * or column is expected (e.g. inside `sql\`\${ref} > 0\`\`).
 *
 * The shape matches `sql.ref()`'s return so a raw fragment from either
 * source is interoperable.
 */
export interface ColumnRef {
  readonly raw: string
}

/**
 * Fluent aggregate-function builder accessible via
 * `eb.fn.count(...)`, `eb.fn.sum(...)`, etc. The chained `.as(name)`
 * names the resulting column in the projection; `.filterWhere(...)`
 * scopes the aggregate to a sub-population (`COUNT(*) FILTER (WHERE
 * status = 'success')` style).
 */
export interface AggregateExpression {
  as: (alias: string) => AggregateExpression
  filterWhere: (column: string, op: ExpressionOperator | string, value: unknown) => AggregateExpression
}

/**
 * Aggregate-function accessor exposed on the expression builder.
 *
 * Covers the call sites in commerce today (`count`, `sum`, `avg`,
 * `min`, `max`). Other Kysely-side aggregates (`countAll`,
 * `coalesce`, etc.) can be added here as call sites surface; we
 * deliberately don't widen to "everything Kysely exposes" because
 * that surface keeps growing and an `any`-typed escape hatch always
 * exists (`eb.fn as any).newThing(...)`) if a one-off bypass is
 * genuinely needed.
 */
export interface ExpressionFunctions {
  count: (column: string) => AggregateExpression
  sum: (column: string) => AggregateExpression
  avg: (column: string) => AggregateExpression
  min: (column: string) => AggregateExpression
  max: (column: string) => AggregateExpression
}

/**
 * Minimal typed expression-builder surface for sub-query / inline-
 * expression callbacks (stacksjs/stacks#1892, T-2 from #1875).
 *
 * Background: the framework's commerce module passed `(eb: any) => …`
 * to `.where()` / `.select()` callbacks across 80+ sites. The `any`
 * escape meant typos like `eb.compare(...)` (no such method — it's
 * `cmpr`) only surfaced at runtime, and any later rename in
 * bun-query-builder couldn't break here at type-check time.
 *
 * This interface declares the methods commerce actually uses today —
 * `or`, `cmpr`, `ref`, `raw`, plus the `fn` aggregate accessor. It
 * intentionally does NOT claim to be the full Kysely
 * `ExpressionBuilder<DB, TB>` type:
 *
 *   - Stacks's `Database` is still typed as `any` (no generated
 *     schema map yet) so the table-aware narrowing Kysely offers
 *     can't be expressed here yet.
 *   - bun-query-builder doesn't currently re-export its internal
 *     `ExpressionBuilder` type, so we can't alias to the canonical
 *     shape upstream.
 *
 * When either of those changes upstream, swap this interface's
 * implementation in one place rather than re-typing every call site.
 */
export interface StacksExpressionBuilder {
  /** Logical OR over a list of sub-expressions. */
  or: (expressions: ReadonlyArray<unknown>) => unknown
  /** Logical AND over a list of sub-expressions. */
  and?: (expressions: ReadonlyArray<unknown>) => unknown
  /**
   * Compare a column / expression against a value or another column
   * with the given operator. Returns an opaque expression value the
   * outer query can consume.
   */
  cmpr: (left: unknown, op: ExpressionOperator, right: unknown) => unknown
  /** Reference a column by name. Returns a {@link ColumnRef}. */
  ref: (column: string) => ColumnRef
  /** Raw SQL fragment. Use sparingly — bypasses parameterization. */
  raw: (value: string) => ColumnRef
  /** Aggregate-function accessor (`eb.fn.count('id')`). */
  fn: ExpressionFunctions
  /** Allow optional uncovered methods without forcing every call site to cast. */
  readonly [extra: string]: unknown
}
