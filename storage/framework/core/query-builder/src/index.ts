/**
 * @stacksjs/query-builder
 *
 * Stacks-side wrapper around `bun-query-builder`. The bulk of the
 * surface is a transparent re-export; this file adds defense-in-depth
 * helpers that consumers should reach for whenever they're about to
 * interpolate untrusted input into SQL identifiers (column names,
 * table names, ORDER BY targets).
 *
 * The vendored runtime has several known SQL-injection vectors when
 * identifiers come from user input — see stacksjs/stacks#1858. The
 * underlying fixes need to land upstream; until they do, the helpers
 * exported below give Stacks code a single chokepoint to validate at.
 */

import * as bunQueryBuilder from 'bun-query-builder'

// Re-export everything from bun-query-builder
export * from 'bun-query-builder'

// For backwards compatibility, export QueryBuilder as an alias
export { createQueryBuilder as QueryBuilder } from 'bun-query-builder'

const stacksModelRegistry = new Map<string, unknown>()

/**
 * Register a model with bun-query-builder when the installed version
 * exposes that hook, or fall back to `defineModel()` for older releases.
 */
export function registerModel(name: string, model: unknown): unknown {
  const upstreamRegisterModel = (bunQueryBuilder as { registerModel?: (name: string, model: unknown) => unknown }).registerModel
  if (typeof upstreamRegisterModel === 'function')
    return upstreamRegisterModel(name, model)

  stacksModelRegistry.set(name, model)

  const definition = typeof (model as { getDefinition?: () => unknown })?.getDefinition === 'function'
    ? (model as { getDefinition: () => unknown }).getDefinition()
    : (model as { definition?: unknown })?.definition

  if (definition && typeof definition === 'object')
    bunQueryBuilder.defineModel(definition as Parameters<typeof bunQueryBuilder.defineModel>[0])

  return model
}

/**
 * Strict identifier pattern: SQL-safe identifiers start with a letter
 * or underscore, then any mix of letters/digits/underscores. No dots
 * (table-qualified identifiers should be split + validated piece by
 * piece), no quotes, no spaces, no special characters.
 *
 * Tighter than the vendored `bun-query-builder` `validateIdentifier`
 * regex (`/^[A-Z_][\w.]*$/i`) which permits unlimited dots and
 * matches `__proto__` / other suspicious shapes.
 */
const SAFE_IDENTIFIER = /^[A-Z_][A-Z0-9_]*$/i

/**
 * Return value of `validateIdentifier` / `assertSafeIdentifier`.
 */
export interface IdentifierValidation {
  valid: boolean
  reason?: 'invalid-shape' | 'not-in-allowlist' | 'empty' | 'too-long'
}

/**
 * Validate a single SQL identifier (column, table, or alias name).
 *
 * - Must match `SAFE_IDENTIFIER` (letters/digits/underscores; must
 *   start with letter or underscore).
 * - Must be ≤ 64 characters (matches MySQL's identifier limit; the
 *   shortest cap across supported dialects).
 * - When `allowlist` is provided, the value must appear in it. Use
 *   this with a model's known column names (`Object.keys(definition.attributes)`)
 *   so a query that builds column names from `req.query.sortBy` etc.
 *   can't smuggle anything past the schema.
 *
 * @example
 * ```ts
 * import { assertSafeIdentifier } from '@stacksjs/query-builder'
 *
 * const sortBy = req.query.sortBy as string
 * assertSafeIdentifier(sortBy, { allowlist: ['name', 'email', 'created_at'] })
 * Model.orderBy(sortBy as keyof Model)
 * ```
 */
export function validateIdentifier(value: unknown, opts: { allowlist?: readonly string[] } = {}): IdentifierValidation {
  if (typeof value !== 'string' || value.length === 0)
    return { valid: false, reason: 'empty' }
  if (value.length > 64)
    return { valid: false, reason: 'too-long' }
  if (!SAFE_IDENTIFIER.test(value))
    return { valid: false, reason: 'invalid-shape' }
  if (opts.allowlist && !opts.allowlist.includes(value))
    return { valid: false, reason: 'not-in-allowlist' }
  return { valid: true }
}

/**
 * Throwing variant of {@link validateIdentifier}. Use at the boundary
 * where user input meets SQL identifier interpolation.
 *
 * @throws {Error} when the value isn't a safe identifier.
 */
export function assertSafeIdentifier(
  value: unknown,
  opts: { allowlist?: readonly string[], context?: string } = {},
): asserts value is string {
  const result = validateIdentifier(value, opts)
  if (result.valid) return
  const ctx = opts.context ? ` in ${opts.context}` : ''
  throw new Error(`[query-builder] Refusing to use ${JSON.stringify(value)} as a SQL identifier${ctx} — ${result.reason}`)
}

/**
 * Validate an SQL operator. Returns `true` only for the documented
 * `WhereOperator` union; everything else is rejected. The vendored
 * runtime interpolates the operator string raw at several call sites
 * (`whereColumn`, `whereJsonPath`, `where(string, op, value)`), so
 * applying this at the boundary prevents an attacker who controls the
 * `op` parameter from injecting `OR 1=1` etc. See stacksjs/stacks#1858
 * Q-4 / Q-5 / Q-6.
 */
const SAFE_OPERATORS = new Set([
  '=', '!=', '<>', '<', '<=', '>', '>=',
  'like', 'not like', 'ilike', 'not ilike',
  'in', 'not in', 'is', 'is not', 'between', 'not between',
])

export function isSafeOperator(op: unknown): op is string {
  return typeof op === 'string' && SAFE_OPERATORS.has(op.toLowerCase())
}

export function assertSafeOperator(op: unknown, context?: string): asserts op is string {
  if (isSafeOperator(op)) return
  const ctx = context ? ` in ${context}` : ''
  throw new Error(`[query-builder] Refusing to use ${JSON.stringify(op)} as a SQL operator${ctx} — not in the allowed set (${[...SAFE_OPERATORS].join(', ')})`)
}
