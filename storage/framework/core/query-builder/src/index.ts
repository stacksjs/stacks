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

import type { DatabaseSchema } from 'bun-query-builder'
import * as bunQueryBuilder from 'bun-query-builder'
import { config as bunQbConfig, createQueryBuilder as createBunQueryBuilder } from 'bun-query-builder'

// Re-export everything from bun-query-builder
export * from 'bun-query-builder'

/**
 * Per-connection SQLite bootstrap pragmas (stacksjs/stacks#1951).
 * `foreign_keys` does not persist in the database file — SQLite ships with
 * enforcement OFF on every new connection — so the inline
 * `REFERENCES … ON DELETE CASCADE` emitted by migrations (#1916) is inert
 * unless the connection bootstrap turns it on. bun-query-builder delegates
 * this to the consumer; this wrapper is the one chokepoint every framework
 * query-builder instance is created through, so applying here covers every
 * connection — including the ORM auto-CRUD route builders that previously
 * bypassed the pragma'd `db` proxy in @stacksjs/database.
 */
export const SQLITE_BOOTSTRAP_PRAGMAS = [
  // WAL is also set by bun-query-builder's SQLiteWrapper at connect time;
  // re-applying is a cheap no-op that guards against upstream drift.
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  'PRAGMA busy_timeout = 5000',
] as const

// bun-query-builder types `unsafe()` as returning `Promise<any>`, but at
// runtime it returns a Bun SQL Statement that has `.execute()`.
type UnsafeReturn = Promise<any> & { execute: () => Promise<any> }

/**
 * Apply the bootstrap pragmas to the connection of the CURRENT process-wide
 * config. bun-query-builder's `qb.unsafe()` routes through its global
 * lazily-resolved connection — NOT the instance's captured one — so this
 * only targets `instance`'s connection when called in the same synchronous
 * tick as `createQueryBuilder()`, before any intervening `setConfig()` can
 * swap the signature-keyed singleton. The wrapped `createQueryBuilder`
 * below guarantees that ordering structurally; standalone callers must
 * preserve it themselves.
 */
export function applySqlitePragmas(instance: { unsafe: (query: string, params?: any[]) => any }): void {
  for (const pragma of SQLITE_BOOTSTRAP_PRAGMAS) {
    try {
      // bun:sqlite executes synchronously inside `.execute()` (the returned
      // promise is created already settled), so every pragma is in effect
      // before this function returns — the first user query can never race
      // ahead of `foreign_keys = ON`. `.catch` prevents an unhandled
      // rejection if a pragma fails; failing open matches pre-#1951 behavior.
      void (instance.unsafe(pragma) as UnsafeReturn).execute().catch(() => {})
    }
    catch {
      // `unsafe()` itself threw — same fail-open rationale as above.
    }
  }
}

/**
 * Drop-in replacement for bun-query-builder's `createQueryBuilder` that
 * bootstraps every fresh SQLite connection with the pragmas above.
 *
 * The upstream builder captures its connection eagerly at creation
 * (`state?.sql ?? getOrCreateBunSql()`) and its `SQLiteWrapper` only sets
 * `journal_mode = WAL` — never `foreign_keys` — so any instance created
 * outside this wrapper runs with FK enforcement off. Applying in the same
 * synchronous tick as creation pins the pragmas to the exact connection the
 * instance captured (see `applySqlitePragmas`). Skipped when the caller
 * supplies its own `state.sql` (reserved/transaction connections derive
 * from an already-bootstrapped parent).
 */
export function createQueryBuilder<DB extends DatabaseSchema<any> = DatabaseSchema<any>>(
  state?: Parameters<typeof createBunQueryBuilder>[0],
): ReturnType<typeof createBunQueryBuilder<DB>> {
  const qb = createBunQueryBuilder<DB>(state)
  if (!state?.sql && bunQbConfig.dialect === 'sqlite')
    applySqlitePragmas(qb)
  return qb
}

// For backwards compatibility, export QueryBuilder as an alias
export { createQueryBuilder as QueryBuilder }

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
