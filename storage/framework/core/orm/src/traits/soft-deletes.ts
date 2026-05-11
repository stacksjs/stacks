/**
 * Soft-delete trait helpers.
 *
 * When a model declares `traits: { useSoftDeletes: true }`, callers
 * get back:
 *   - `instance.delete()` writes `deleted_at = NOW()` instead of
 *     issuing DELETE
 *   - `instance.restore()` clears `deleted_at`
 *   - `instance.forceDelete()` issues a real DELETE
 *   - `Model.withTrashed()` returns a query builder that includes
 *     soft-deleted rows (default queries hide them)
 *   - `Model.onlyTrashed()` returns just the soft-deleted rows
 *
 * The trait also accepts an object form for cascade configuration:
 *
 *   `traits: { useSoftDeletes: { cascade: ['posts', 'comments'] } }`
 *
 * When the parent is soft-deleted, each named relation is also soft-deleted
 * (or hard-deleted, if the child model doesn't itself have softDeletes on).
 * Cascade works for `restore()` too, so a single restore brings the parent
 * and its children back together — see the JSDoc on `restore` for the
 * tradeoff this makes.
 *
 * The implementation here is a thin layer that sits on top of the
 * underlying bun-query-builder primitives — it doesn't change the
 * model definition surface, just the runtime behavior of `delete()`
 * and friends when the trait is on.
 */

import { log } from '@stacksjs/logging'

interface SoftDeleteCapableModel {
  where: (...args: unknown[]) => any
  query?: () => any
  delete?: (...args: unknown[]) => unknown
}

const DELETED_AT_COLUMN = 'deleted_at'

/**
 * Object-form options for `traits.useSoftDeletes`.
 *
 * @example
 * ```ts
 * traits: {
 *   useSoftDeletes: {
 *     // Names of relations declared on this model (hasMany / hasOne)
 *     // that should be soft-deleted alongside the parent.
 *     cascade: ['posts', 'comments'],
 *   },
 * }
 * ```
 */
export interface SoftDeleteOptions {
  /**
   * Relation names (matching keys on the model definition's `hasMany` /
   * `hasOne`) that should be soft-deleted when the parent is deleted, and
   * restored when the parent is restored.
   */
  cascade?: ReadonlyArray<string>
}

export interface SoftDeleteHelpers {
  /** Mark a row as soft-deleted (sets `deleted_at`). */
  softDelete: (id: number | string) => Promise<boolean>
  /** Restore a soft-deleted row. */
  restore: (id: number | string) => Promise<boolean>
  /** Issue a real DELETE, bypassing the soft-delete trait. */
  forceDelete: (id: number | string) => Promise<boolean>
  /** Query builder including soft-deleted rows. */
  withTrashed: () => any
  /** Query builder restricted to soft-deleted rows. */
  onlyTrashed: () => any
}

/**
 * Build the runtime methods backing the soft-delete trait. The trait is
 * applied via `applySoftDeletes()` in `define-model.ts`.
 *
 * @example
 * ```ts
 * const helpers = createSoftDeleteMethods(model, 'id')
 * await helpers.softDelete(42)
 * ```
 */
export function createSoftDeleteMethods(model: SoftDeleteCapableModel, primaryKey: string = 'id'): SoftDeleteHelpers {
  return {
    async softDelete(id) {
      const now = new Date().toISOString()
      const q: any = (model as any).where(primaryKey, id)
      if (typeof q?.update === 'function') {
        await q.update({ [DELETED_AT_COLUMN]: now })
        return true
      }
      return false
    },

    async restore(id) {
      const q: any = (model as any).where(primaryKey, id)
      if (typeof q?.update === 'function') {
        await q.update({ [DELETED_AT_COLUMN]: null })
        return true
      }
      return false
    },

    async forceDelete(id) {
      // Bypass the soft-delete shim and call the real query.delete().
      const q: any = (model as any).where(primaryKey, id)
      if (typeof q?.delete === 'function') {
        await q.delete()
        return true
      }
      return false
    },

    withTrashed() {
      // Vanilla query builder — no `whereNull('deleted_at')` filter
      // injection, so soft-deleted rows are visible.
      return typeof model.query === 'function' ? model.query() : (model as any)
    },

    onlyTrashed() {
      const q: any = typeof model.query === 'function' ? model.query() : (model as any)
      if (typeof q?.whereNotNull === 'function') return q.whereNotNull(DELETED_AT_COLUMN)
      // Fallback for builders that don't expose whereNotNull
      return q?.where?.(DELETED_AT_COLUMN, '!=', null) ?? q
    },
  }
}

/**
 * Convert `traits.useSoftDeletes` into a normalized options object. The
 * trait accepts either `true` (legacy) or `{ cascade: [...] }` (new), so
 * downstream code should always go through this resolver.
 *
 * @example
 * ```ts
 * resolveSoftDeleteOptions(true)                       // → {}
 * resolveSoftDeleteOptions({ cascade: ['posts'] })     // → { cascade: ['posts'] }
 * ```
 */
export function resolveSoftDeleteOptions(value: unknown): SoftDeleteOptions {
  if (value === true || value == null) return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    const v = value as { cascade?: unknown }
    if (Array.isArray(v.cascade)) {
      const cascade = v.cascade.filter((x): x is string => typeof x === 'string')
      return cascade.length ? { cascade } : {}
    }
    return {}
  }
  return {}
}

/**
 * Look up a child model by its relation name (hasMany / hasOne) on the
 * parent definition and return its loaded module from globalThis (where
 * @stacksjs/orm injects every loaded model). Returns `null` when the
 * relation isn't declared or the child model hasn't been loaded yet —
 * either case logs a warning so users know cascade silently skipped.
 *
 * The lookup uses globalThis specifically because traits can't statically
 * import sibling models (cycle: User → cascade Posts → Post → User). The
 * orm barrel populates globalThis once both ends are resolved.
 */
function resolveChildModel(
  parentDefinition: { hasMany?: ReadonlyArray<string>, hasOne?: ReadonlyArray<string> },
  relationName: string,
): { className: string, model: Record<string, unknown> } | null {
  const hasMany = parentDefinition.hasMany ?? []
  const hasOne = parentDefinition.hasOne ?? []
  // The relation name in `cascade: [...]` matches what users see at access
  // time (`post.comments`) — that's the lowercase + pluralized form for
  // hasMany and the lowercase form for hasOne. We try both shapes.
  const isHasMany = hasMany.some(c => relationMatches(c, relationName, true))
  const isHasOne = hasOne.some(c => relationMatches(c, relationName, false))
  if (!isHasMany && !isHasOne) {
    log.warn(`[orm] soft-delete cascade: '${relationName}' is not a declared hasMany/hasOne relation — skipping`)
    return null
  }

  // Find the actual child class name from the relation name.
  const candidates = isHasMany ? hasMany : hasOne
  const className = candidates.find(c => relationMatches(c, relationName, isHasMany)) ?? null
  if (!className) return null

  const g = globalThis as Record<string, unknown>
  const model = g[className] as Record<string, unknown> | undefined
  if (!model) {
    log.warn(`[orm] soft-delete cascade: model '${className}' is not yet on globalThis — skipping cascade for '${relationName}'`)
    return null
  }
  return { className, model }
}

/** Lowercase + (optionally) pluralize a class name for relation matching. */
function relationMatches(className: string, relationName: string, plural: boolean): boolean {
  const base = className.toLowerCase()
  if (relationName === base) return true
  if (plural && relationName === `${base}s`) return true
  // Trailing-y plurals (Category → categories). Cheap heuristic; if a
  // user names something that escapes this, they can pass the exact
  // relation name and it'll still match the singular branch above.
  if (plural && base.endsWith('y') && relationName === `${base.slice(0, -1)}ies`) return true
  return false
}

/**
 * Soft-delete (or hard-delete, if the child has no softDeletes trait) all
 * rows of `childModel` that point at the parent via `foreignKey`. Errors
 * are logged but not re-thrown — a failed cascade should not undo the
 * parent's already-committed write.
 */
async function cascadeChildren(
  parentClassName: string,
  parentId: number | string,
  childModel: Record<string, unknown>,
  foreignKey: string,
  action: 'softDelete' | 'restore',
): Promise<void> {
  try {
    const where = childModel.where as ((..._a: unknown[]) => any) | undefined
    if (typeof where !== 'function') {
      log.warn(`[orm] cascade ${action}: child model has no .where()`)
      return
    }

    if (action === 'softDelete') {
      // Prefer the child's own soft-delete shim — it does the right thing
      // (timestamp + any per-model audit hook). If the child has no
      // softDelete static, fall back to a real DELETE so we still respect
      // the user's intent of "remove these dependents."
      const childSoftDelete = childModel.softDelete as ((..._a: unknown[]) => Promise<unknown>) | undefined
      if (typeof childSoftDelete === 'function') {
        // We need each child's PK to call softDelete(id). Pull the rows
        // first, then iterate. For very large fan-outs this is slower than
        // a bulk update, but it preserves any per-row hooks (audit trait,
        // observers) the child has wired up — that's worth more than raw
        // throughput here.
        const q = where.call(childModel, foreignKey, parentId)
        const rows: unknown[] = typeof q?.get === 'function' ? await q.get() : (Array.isArray(q) ? q : [])
        const childPk = (childModel as { primaryKey?: string }).primaryKey || 'id'
        for (const r of rows) {
          const id = (r as Record<string, unknown>)?.[childPk] as number | string | undefined
          if (id != null) {
            // eslint-disable-next-line no-await-in-loop
            await childSoftDelete.call(childModel, id)
          }
        }
        return
      }

      // Child has no softDelete — issue a bulk DELETE via the query builder.
      const q = where.call(childModel, foreignKey, parentId)
      if (typeof q?.delete === 'function') {
        log.debug(`[orm] cascade soft-delete: child has no softDeletes trait, hard-deleting from ${String(childModel.table ?? '?')}`)
        await q.delete()
        return
      }
    }
    else {
      // Restore: only meaningful if the child actually has soft-deletes.
      // Without it there's no `deleted_at` column to clear.
      const childRestore = childModel.restore as ((..._a: unknown[]) => Promise<unknown>) | undefined
      if (typeof childRestore !== 'function') {
        log.debug(`[orm] cascade restore: child has no restore() — nothing to do`)
        return
      }
      // Restore every row currently pointing at the parent (whether
      // soft-deleted or not — restoring a non-deleted row is a no-op).
      // We use `withTrashed()` if available so soft-deleted rows are
      // visible to the where clause; otherwise the default query has
      // already filtered them out and we'd find nothing to restore.
      const withTrashed = childModel.withTrashed as (() => any) | undefined
      const baseQ = typeof withTrashed === 'function' ? withTrashed.call(childModel) : childModel
      const q = (baseQ as { where?: (...a: unknown[]) => any }).where?.(foreignKey, parentId)
      const rows: unknown[] = typeof q?.get === 'function' ? await q.get() : []
      const childPk = (childModel as { primaryKey?: string }).primaryKey || 'id'
      for (const r of rows) {
        const id = (r as Record<string, unknown>)?.[childPk] as number | string | undefined
        if (id != null) {
          // eslint-disable-next-line no-await-in-loop
          await childRestore.call(childModel, id)
        }
      }
    }
  }
  catch (err) {
    log.warn(`[orm] soft-delete cascade ${action} on ${parentClassName}#${String(parentId)} failed`, { error: err })
  }
}

/**
 * Run cascade soft-delete (or restore) for every relation listed in
 * `options.cascade`. Called by `define-model.ts` immediately after the
 * parent's own soft-delete or restore succeeds.
 *
 * IMPORTANT: cascade is fire-and-forget on the audit/observer side — this
 * function awaits each child to ensure ordering (parent before children
 * for delete, vice versa for restore) but does not propagate child
 * failures up to the caller. The parent operation has already committed.
 *
 * @example
 * ```ts
 * await cascadeSoftDelete(parentDefinition, options, parentId, 'softDelete')
 * ```
 */
export async function cascadeSoftDelete(
  parentDefinition: { name: string, hasMany?: ReadonlyArray<string>, hasOne?: ReadonlyArray<string> },
  options: SoftDeleteOptions,
  parentId: number | string,
  action: 'softDelete' | 'restore',
): Promise<void> {
  const cascade = options.cascade
  if (!cascade || cascade.length === 0) return

  // Convention: a child's foreign key to its parent is `<parent>_id` in
  // snake_case. This matches Stacks model generators and bun-query-builder's
  // default. Models that override the foreign key on the child side aren't
  // currently supported by the cascade — flagged below as a future
  // extension point.
  const parentFk = `${parentDefinition.name.toLowerCase()}_id`

  for (const relationName of cascade) {
    const resolved = resolveChildModel(parentDefinition, relationName)
    if (!resolved) continue
    // eslint-disable-next-line no-await-in-loop
    await cascadeChildren(resolved.className, parentId, resolved.model, parentFk, action)
  }
}
