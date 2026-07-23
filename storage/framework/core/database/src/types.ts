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
  /**
   * Alias the fragment for use in a SELECT projection. Returns a new
   * fragment rendering as `<sql> AS <alias>`.
   *
   * The alias is interpolated as text - fragments flow through the
   * query builder's select pipeline as verbatim `.sql` text, never as
   * parameters - so it must be a plain SQL identifier. Anything else
   * throws instead of risking SQL injection.
   */
  as: (alias: string) => Sql
  /**
   * Render the fragment as its SQL text. Lets join-based builder APIs
   * (`groupBy`, `orderBy`) consume fragments via `String(fragment)`.
   */
  toString: () => string
}

/**
 * Identifier shapes we are willing to interpolate into SQL text.
 * Aliases and aggregate columns go in as TEXT (the fragment pipeline
 * renders `.sql` verbatim), so anything outside a plain identifier is
 * rejected rather than escaped. Mirrors the defense-in-depth posture of
 * `@stacksjs/query-builder`'s `assertSafeIdentifier` (#1858).
 */
const SAFE_ALIAS = /^[A-Z_][A-Z0-9_]*$/i
const SAFE_COLUMN = /^[A-Z_][A-Z0-9_]*(\.[A-Z_][A-Z0-9_]*)?$/i

function assertSqlTextIdentifier(value: string, kind: 'alias' | 'column'): void {
  const safe = kind === 'column' ? SAFE_COLUMN : SAFE_ALIAS
  if (!safe.test(value))
    throw new TypeError(`[database] refusing to interpolate unsafe ${kind} ${JSON.stringify(value)} into SQL text - expected a plain identifier (letters, digits, underscores)`)
}

function createSqlFragment(text: string, parameters: unknown[]): Sql {
  return {
    sql: text,
    parameters,
    as(alias: string): Sql {
      assertSqlTextIdentifier(alias, 'alias')
      return createSqlFragment(`${text} AS ${alias}`, parameters)
    },
    toString(): string {
      return text
    },
  }
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

  return createSqlFragment(sqlParts.join(''), parameters)
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
 * Inline a JS value into a `sql` fragment as a SQL literal (numbers and
 * booleans bare, everything else single-quoted with standard `''`
 * escaping). Returns the raw marker the template splices in as text.
 *
 * Use ONLY where the query pipeline cannot bind parameters - raw WHERE
 * fragments on the select builder render their `.sql` text verbatim and
 * drop `parameters`, so bound placeholders would arrive unbound.
 * Everywhere a bound parameter is supported, prefer it.
 *
 * @example
 * ```ts
 * db.selectFrom('gift_cards')
 *   .whereRaw(sql`(expiry_date >= ${sql.literal(now)} OR expiry_date IS NULL)`)
 * ```
 */
sql.literal = function literal(value: unknown): { raw: string } {
  return { raw: inlineSqlLiteral(value) }
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
  as: (alias: string) => ColumnRef
}

/**
 * Fluent aggregate-function builder accessible via
 * `eb.fn.count(...)`, `eb.fn.sum(...)`, etc. The chained `.as(name)`
 * names the resulting column in the projection; `.filterWhere(...)`
 * scopes the aggregate to a sub-population (`COUNT(*) FILTER (WHERE
 * status = 'success')` style).
 *
 * The `sql` text is part of the contract: bun-query-builder's select
 * pipeline renders fragments from their `.sql` property, so every
 * chain step returns a fresh expression with the fully rendered text.
 */
export interface AggregateExpression {
  /** The rendered SQL text, e.g. `COUNT(id) FILTER (WHERE status = 1) AS count`. */
  readonly sql: string
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
  countAll: () => AggregateExpression
  count: (column: string) => AggregateExpression
  sum: (column: string) => AggregateExpression
  avg: (column: string) => AggregateExpression
  min: (column: string) => AggregateExpression
  max: (column: string) => AggregateExpression
}

/**
 * Operators allowed inside `filterWhere`. The rendered text is
 * interpolated verbatim into the fragment, so the operator is validated
 * against this allowlist rather than escaped (#1858). Array semantics
 * (`in` / `not in`) are intentionally excluded: values are inlined as
 * single literals, which cannot express an IN-list.
 */
const SAFE_FILTER_OPERATORS = new Set([
  '=', '!=', '<>', '<', '<=', '>', '>=',
  'like', 'not like', 'ilike', 'not ilike',
  'is', 'is not',
])

/**
 * Inline a JS value as a SQL literal. Fragments passed to `select()`
 * lose their `parameters` (the builder renders only their `.sql`
 * text), so filtered aggregates inline values instead - safely, with
 * strict typing and standard `''` quote escaping.
 */
function inlineSqlLiteral(_value: unknown): string {
  if (value === null || value === undefined)
    return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError(`[database] refusing to inline non-finite number into SQL: ${value}`)
    return String(value)
  }
  if (typeof value === 'boolean')
    return value ? '1' : '0'
  if (typeof value === 'bigint')
    return value.toString()
  return `'${String(value).replace(/'/g, "''")}'`
}

function createAggregateExpression(text: string): AggregateExpression {
  return {
    sql: text,
    as(alias: string): AggregateExpression {
      assertSqlTextIdentifier(alias, 'alias')
      return createAggregateExpression(`${text} AS ${alias}`)
    },
    filterWhere(column: string, op: ExpressionOperator | string, value: unknown): AggregateExpression {
      assertSqlTextIdentifier(column, 'column')
      if (!SAFE_FILTER_OPERATORS.has(op.toLowerCase()))
        throw new TypeError(`[database] refusing unsafe aggregate filter operator ${JSON.stringify(op)} - allowed: ${[...SAFE_FILTER_OPERATORS].join(', ')}`)
      return createAggregateExpression(`${text} FILTER (WHERE ${column} ${op} ${inlineSqlLiteral(value)})`)
    },
  }
}

function aggregate(name: string, column?: string): AggregateExpression {
  if (column !== undefined)
    assertSqlTextIdentifier(column, 'column')
  return createAggregateExpression(column === undefined ? `${name}(*)` : `${name}(${column})`)
}

/**
 * Runtime implementation behind `db.fn`. bun-query-builder has no
 * top-level `fn` accessor (its select pipeline consumes plain SQL
 * fragments), so the `db` proxy serves this object directly. Every
 * aggregate renders to a fragment whose `.sql` text the select /
 * groupBy machinery picks up verbatim, e.g.:
 *
 * ```ts
 * db.selectFrom('query_logs')
 *   .select(db.fn.count('id').as('count'))
 *   .execute()
 * // SELECT COUNT(id) AS count FROM query_logs
 * ```
 */
export const aggregateFunctions: ExpressionFunctions = {
  countAll: () => aggregate('COUNT'),
  count: column => aggregate('COUNT', column),
  sum: column => aggregate('SUM', column),
  avg: column => aggregate('AVG', column),
  min: column => aggregate('MIN', column),
  max: column => aggregate('MAX', column),
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
  (left: unknown, op: ExpressionOperator | string, right: unknown): unknown
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
