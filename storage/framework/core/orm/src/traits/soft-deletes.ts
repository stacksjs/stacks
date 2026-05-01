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
 * The implementation here is a thin layer that sits on top of the
 * underlying bun-query-builder primitives — it doesn't change the
 * model definition surface, just the runtime behavior of `delete()`
 * and friends when the trait is on.
 */

interface SoftDeleteCapableModel {
  where: (...args: unknown[]) => any
  query?: () => any
  delete?: (...args: unknown[]) => unknown
}

const DELETED_AT_COLUMN = 'deleted_at'

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
