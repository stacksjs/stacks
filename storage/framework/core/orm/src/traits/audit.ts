/**
 * Audit log trait helpers.
 *
 * When a model declares `traits: { useAudit: true }`, every create/update/delete
 * writes a row to the `model_audits` table capturing what changed, who changed
 * it, and when. The intent is to give apps a no-effort change log they can
 * surface in admin dashboards without rolling their own observers.
 *
 * The trait wires three things into the model:
 *   - `Model.create(...)`     → writes an `event: 'created'` audit row
 *   - `Model.update(id, ...)` → writes an `event: 'updated'` audit row with
 *                                old_values / new_values diff
 *   - `Model.delete(id)`      → writes an `event: 'deleted'` audit row with
 *                                the final pre-delete state. Plays nicely with
 *                                soft-deletes — it audits regardless of which
 *                                trait runs first.
 *
 * Sensitive fields (passwords, tokens, secrets) are stripped before logging
 * so the audit table never becomes a credential leak.
 *
 * ### `model_audits` table schema
 *
 * The trait expects (and the framework will create on first install) a table
 * shaped like this:
 *
 * ```sql
 * CREATE TABLE model_audits (
 *   id              INTEGER PRIMARY KEY AUTOINCREMENT,
 *   auditable_type  VARCHAR(255) NOT NULL,  -- e.g. 'User', 'Post'
 *   auditable_id    INTEGER NOT NULL,       -- PK of the audited row
 *   event           VARCHAR(32)  NOT NULL,  -- 'created' | 'updated' | 'deleted'
 *   old_values      TEXT,                   -- JSON, null on create
 *   new_values      TEXT,                   -- JSON, null on delete
 *   user_id         INTEGER,                -- nullable (CLI/cron audits have none)
 *   created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
 * );
 * CREATE INDEX idx_model_audits_lookup
 *   ON model_audits (auditable_type, auditable_id, created_at);
 * ```
 *
 * The migration that creates this table lives at
 * `storage/framework/core/database/src/custom/audits.ts`.
 */

import { log } from '@stacksjs/logging'

/**
 * Field-name patterns whose values should never end up in an audit row.
 * Matching is case-insensitive against the attribute name. Compiled once
 * to avoid re-parsing the regex per row.
 */
const SENSITIVE_FIELD_PATTERNS = [
  /^password$/i,
  /^password_hash$/i,
  /^api_key$/i,
  /_token$/i,
  /_secret$/i,
  /^remember_token$/i,
]

const AUDITS_TABLE = 'model_audits'

/**
 * Module-level audit user override. Useful for queue jobs, CLI commands, and
 * cron tasks that have no associated HTTP request — set this once at the
 * top of the job and the same id is used for every audit row written during
 * the run. Cleared with `setAuditUser(null)`.
 */
let _explicitAuditUserId: number | string | null = null

/**
 * Override the user id attached to subsequent audit rows. Useful in queue
 * workers, scheduled jobs, and CLI commands where there is no current HTTP
 * request to extract the user from. Pass `null` to clear the override and
 * fall back to the request-derived id.
 *
 * @example
 * ```ts
 * import { setAuditUser } from '@stacksjs/orm'
 *
 * // In a queue job that's running on behalf of user 42:
 * setAuditUser(42)
 * try { await processOrder(orderId) } finally { setAuditUser(null) }
 * ```
 */
export function setAuditUser(id: number | string | null): void {
  _explicitAuditUserId = id
}

/**
 * Resolve the user id to attach to an audit row. Priority order:
 *   1. The explicit override set via `setAuditUser()` (queue / CLI use).
 *   2. The current HTTP request's authed user.
 *   3. `null` — perfectly fine; the table column is nullable.
 *
 * Failures are swallowed: the auth/router packages may not be loaded in
 * every runtime (tests, scripts), and a missing user should never block a
 * write. The audit table just gets a `null` user_id in that case.
 */
async function resolveAuditUserId(): Promise<number | string | null> {
  if (_explicitAuditUserId != null) return _explicitAuditUserId

  try {
    // Lazy-imported because @stacksjs/router may not be installed in all
    // runtimes that consume @stacksjs/orm (e.g. CLI build steps).
    const mod = await import('@stacksjs/router').catch(() => null)
    if (!mod) return null
    const getCurrentRequest = (mod as { getCurrentRequest?: () => unknown }).getCurrentRequest
    if (typeof getCurrentRequest !== 'function') return null
    const request = getCurrentRequest() as { user?: { id?: number | string }, _user?: { id?: number | string } } | null | undefined
    if (!request) return null
    // Different middleware sets the user under slightly different names;
    // try the common ones rather than forcing every caller into one shape.
    const user = request.user ?? request._user
    return user?.id ?? null
  }
  catch {
    return null
  }
}

/**
 * Strip fields whose names match the sensitive-field denylist. Returns a
 * new object — never mutates the input, since the caller is also using
 * the original to actually write to the database.
 */
function redactSensitive(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (SENSITIVE_FIELD_PATTERNS.some(rx => rx.test(k))) continue
    out[k] = v
  }
  return out
}

/**
 * Resolve a value down to its bare attribute bag. Stacks model instances
 * carry their data on `_attributes`; falling back to the value itself
 * lets callers pass already-plain rows (e.g. from `Model.find()` after
 * `toAttrs()`).
 */
function plainAttrs(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { _attributes?: Record<string, unknown> }
  if (v._attributes && typeof v._attributes === 'object') return { ...v._attributes }
  return { ...(value as Record<string, unknown>) }
}

/**
 * Compute the diff between an old and new row, returning only the keys that
 * actually changed. Used so an audit row's `old_values` / `new_values`
 * captures the meaningful delta, not the full table dump.
 */
function diffAttrs(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { old: Record<string, unknown> | null, next: Record<string, unknown> | null } {
  if (!before || !after) return { old: before, next: after }
  const old: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const k of keys) {
    if (before[k] !== after[k]) {
      old[k] = before[k]
      next[k] = after[k]
    }
  }
  return { old, next }
}

/**
 * Insert a single audit row. All errors are swallowed and logged — auditing
 * is best-effort, never load-bearing. If we couldn't write the audit (table
 * missing in dev, db down, etc.) we don't want to abort the user's actual
 * write that just succeeded.
 */
async function writeAuditRow(payload: {
  auditable_type: string
  auditable_id: number | string
  event: 'created' | 'updated' | 'deleted'
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  user_id: number | string | null
}): Promise<void> {
  try {
    const { db } = await import('@stacksjs/database')
    await db.insertInto(AUDITS_TABLE).values({
      auditable_type: payload.auditable_type,
      auditable_id: payload.auditable_id,
      event: payload.event,
      old_values: payload.old_values ? JSON.stringify(payload.old_values) : null,
      new_values: payload.new_values ? JSON.stringify(payload.new_values) : null,
      user_id: payload.user_id,
      created_at: new Date().toISOString(),
    } as Record<string, unknown>).executeTakeFirst()
  }
  catch (err) {
    log.warn(`[orm] audit row write failed for ${payload.auditable_type}#${String(payload.auditable_id)} (${payload.event})`, { error: err })
  }
}

export interface AuditHelpers {
  /**
   * Fetch the audit trail for a single row, newest first.
   *
   * @example
   * ```ts
   * const trail = await User.audits(userId)
   * for (const entry of trail) {
   *   console.log(entry.event, entry.created_at, entry.user_id)
   * }
   * ```
   */
  audits: (id: number | string) => Promise<Array<Record<string, unknown>>>
}

interface AuditCapableModel {
  name: string
  create?: (...args: unknown[]) => unknown
  update?: (...args: unknown[]) => unknown
  delete?: (...args: unknown[]) => unknown
  find?: (...args: unknown[]) => unknown
  softDelete?: (...args: unknown[]) => unknown
}

/**
 * Build the public-facing audit helper(s). Right now that's just
 * `audits(id)` — the rest is wired up via `applyAudit()` which intercepts
 * the model's write methods.
 */
export function createAuditMethods(modelName: string): AuditHelpers {
  return {
    async audits(id) {
      try {
        const { db } = await import('@stacksjs/database')
        const rows = await db
          .selectFrom(AUDITS_TABLE)
          .selectAll()
          .where('auditable_type', '=', modelName)
          .where('auditable_id', '=', id)
          .orderBy('created_at', 'desc')
          .execute()
        // Inflate JSON columns so callers don't have to JSON.parse every row.
        return (rows ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          old_values: typeof r.old_values === 'string' ? safeJsonParse(r.old_values) : r.old_values,
          new_values: typeof r.new_values === 'string' ? safeJsonParse(r.new_values) : r.new_values,
        }))
      }
      catch (err) {
        log.warn(`[orm] audits() lookup failed for ${modelName}#${String(id)}`, { error: err })
        return []
      }
    },
  }
}

function safeJsonParse(value: string): unknown {
  try { return JSON.parse(value) }
  catch { return value }
}

/**
 * Wire the audit trait into a model's static surface. Wraps `create`,
 * `update`, and `delete` so each one writes a `model_audits` row after a
 * successful operation. Idempotent against the proxy machinery — relies on
 * the same wrapping pattern used by `applySoftDeletes`.
 *
 * Must run AFTER the static-helpers / cast / soft-delete wrappers have
 * installed their own versions of `create` / `update` / `delete`, so that
 * we wrap the final composed function rather than something that gets
 * shadowed later.
 *
 * @example
 * ```ts
 * // Inside defineModel():
 * if (definition.traits?.useAudit) {
 *   applyAudit(baseModel, definition)
 * }
 * ```
 */
export function applyAudit(baseModel: Record<string, unknown>, modelName: string, primaryKey: string = 'id'): void {
  const model = baseModel as AuditCapableModel & Record<string, unknown>

  // Expose the public `Model.audits(id)` query helper. Assigned only if the
  // model doesn't already have one (a userland override or generator output
  // wins over the trait's default).
  if (typeof baseModel.audits !== 'function') {
    baseModel.audits = createAuditMethods(modelName).audits
  }

  // CREATE: capture the inserted row as new_values.
  const origCreate = baseModel.create
  if (typeof origCreate === 'function') {
    baseModel.create = async function (...args: unknown[]) {
      const result = await (origCreate as (...a: unknown[]) => unknown).apply(this, args)
      try {
        const newAttrs = plainAttrs(result)
        const id = newAttrs?.[primaryKey] as number | string | undefined
        if (id != null) {
          const userId = await resolveAuditUserId()
          await writeAuditRow({
            auditable_type: modelName,
            auditable_id: id,
            event: 'created',
            old_values: null,
            new_values: redactSensitive(newAttrs),
            user_id: userId,
          })
        }
      }
      catch (err) {
        log.warn(`[orm] audit(create) failed for ${modelName}`, { error: err })
      }
      return result
    }
  }

  // UPDATE: read the row before and after so we can diff. The `before` read
  // happens before the actual write, so a failed write produces no audit
  // row — exactly what we want.
  const origUpdate = baseModel.update
  if (typeof origUpdate === 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      const find = model.find as ((_id: number | string) => Promise<unknown>) | undefined
      const before = typeof find === 'function' ? plainAttrs(await find.call(model, id)) : null
      const result = await (origUpdate as (i: number | string, d: Record<string, unknown>) => unknown).call(this, id, data)
      try {
        const after = plainAttrs(result) ?? (typeof find === 'function' ? plainAttrs(await find.call(model, id)) : null)
        const { old, next } = diffAttrs(before, after)
        // Skip the audit row entirely if nothing actually changed — saves
        // a row per redundant-update call site (idempotent saves are
        // common in queue retries).
        if (next && Object.keys(next).length > 0) {
          const userId = await resolveAuditUserId()
          await writeAuditRow({
            auditable_type: modelName,
            auditable_id: id,
            event: 'updated',
            old_values: redactSensitive(old),
            new_values: redactSensitive(next),
            user_id: userId,
          })
        }
      }
      catch (err) {
        log.warn(`[orm] audit(update) failed for ${modelName}#${String(id)}`, { error: err })
      }
      return result
    }
  }

  // DELETE: snapshot the row before deletion so we can record its final
  // state. Wraps both `delete` and (if soft-deletes is on) `softDelete`,
  // since the trait may have aliased one to the other.
  const wrapDelete = (key: 'delete' | 'softDelete') => {
    const orig = baseModel[key]
    if (typeof orig !== 'function') return
    baseModel[key] = async function (id: number | string) {
      const find = model.find as ((_id: number | string) => Promise<unknown>) | undefined
      const before = typeof find === 'function' ? plainAttrs(await find.call(model, id)) : null
      const result = await (orig as (i: number | string) => unknown).call(this, id)
      try {
        // Only audit when the underlying op claims it actually deleted
        // something — `delete()` returns `false` for missing rows.
        if (result !== false && before) {
          const userId = await resolveAuditUserId()
          await writeAuditRow({
            auditable_type: modelName,
            auditable_id: id,
            event: 'deleted',
            old_values: redactSensitive(before),
            new_values: null,
            user_id: userId,
          })
        }
      }
      catch (err) {
        log.warn(`[orm] audit(${key}) failed for ${modelName}#${String(id)}`, { error: err })
      }
      return result
    }
  }
  wrapDelete('delete')
  wrapDelete('softDelete')
}
