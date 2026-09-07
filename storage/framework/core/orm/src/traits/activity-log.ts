/**
 * Activity-log trait: a readable feed of what happened to a model.
 *
 * `traits: { useActivityLog: true }` writes one `activities` row per create,
 * update and delete: what happened, to which record, who did it, from where,
 * and which attributes were involved.
 *
 * ### Not the same thing as `useAudit`
 *
 * Both trails record writes, and the two tables say what each is for.
 * `model_audits` carries `old_values` and `new_values` - a diff, for asking
 * later what a row used to be. `activities` carries `type`, `description`,
 * `subject_type`/`subject_id`, `causer` and `properties` - a feed, for showing
 * a person what has been going on. The `Activity` model even ships
 * `useApi: { routes: ['index', 'show'] }`, because something reads it.
 *
 * A model may declare both. They write different rows to different tables and
 * neither reads the other.
 *
 * ### Which attributes are recorded
 *
 * `useActivityLog: true` records every attribute except the model's `hidden`
 * ones and anything matching the shared sensitive-field denylist - a password
 * hash in a feed row is a credential leak whichever table it lands in.
 *
 * The object form narrows it further:
 *
 * ```ts
 * traits: {
 *   useActivityLog: { logOnly: ['status', 'total'] },  // only these
 *   // or
 *   useActivityLog: { exclude: ['internal_notes'] },   // everything but these
 *   // or
 *   useActivityLog: { include: ['name', 'email'] },    // same as logOnly, Spatie's spelling
 * }
 * ```
 *
 * `logOnly` and `include` mean the same thing and `logOnly` wins if both are
 * given. `exclude` applies after either. A `logOnly` naming a hidden attribute
 * still does not get it: asking for a column by name is not a reason to put a
 * password in a feed.
 *
 * @see https://github.com/stacksjs/stacks/issues/2435
 */
import { sqlDateTime } from '@stacksjs/database'
import { redactSensitive, reportTrailFailure, resolveTrailActorId, resolveTrailIp } from './actor'

const ACTIVITIES_TABLE = 'activities'

/** The lifecycle moments an activity row is written for. */
export type ActivityEvent = 'created' | 'updated' | 'deleted'

export interface ActivityLogOptions {
  /** Record only these attributes. Wins over `include` when both are given. */
  logOnly?: string[]
  /** Spelling of `logOnly` carried over from Spatie's activitylog. */
  include?: string[]
  /** Drop these, after `logOnly` / `include` has been applied. */
  exclude?: string[]
}

/**
 * Normalise the trait declaration.
 *
 * Returns `null` when the trait is off, so the caller can skip building hooks
 * at all rather than building ones that no-op per write.
 */
export function resolveActivityLogOptions(declaration: unknown): ActivityLogOptions | null {
  if (!declaration)
    return null

  if (declaration === true)
    return {}

  if (typeof declaration !== 'object')
    return null

  const options = declaration as ActivityLogOptions
  return {
    logOnly: Array.isArray(options.logOnly) ? options.logOnly : undefined,
    include: Array.isArray(options.include) ? options.include : undefined,
    exclude: Array.isArray(options.exclude) ? options.exclude : undefined,
  }
}

/**
 * The attributes this row should carry.
 *
 * Hidden attributes are dropped before the selection is applied, not after, so
 * naming one in `logOnly` cannot pull it back in.
 */
export function selectLoggedProperties(
  attributes: Record<string, unknown> | null | undefined,
  options: ActivityLogOptions,
  hidden: readonly string[] = [],
): Record<string, unknown> | null {
  const safe = redactSensitive(attributes)
  if (!safe)
    return null

  const hiddenSet = new Set(hidden)
  const wanted = options.logOnly ?? options.include
  const excluded = new Set(options.exclude ?? [])

  const properties: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(safe)) {
    if (hiddenSet.has(key) || excluded.has(key))
      continue
    if (wanted && !wanted.includes(key))
      continue
    properties[key] = value
  }
  return properties
}

/** `User 42 was created` - the line a feed shows when nothing else is set. */
export function describeActivity(modelName: string, event: ActivityEvent, id: number | string | null): string {
  return id == null ? `${modelName} was ${event}` : `${modelName} ${String(id)} was ${event}`
}

/**
 * Write one activity row.
 *
 * Never throws. The row describes a write that already succeeded, and failing
 * that write because its description could not be filed would be the wrong way
 * round - `activities` is a feed, not a ledger the application depends on. A
 * failure is reported once, by name, rather than swallowed.
 */
export async function writeActivityRow(payload: {
  type: string
  description: string
  subject_type: string
  subject_id: number | string | null
  properties: Record<string, unknown> | null
  causer: string | null
  user_id: number | string | null
  ip_address: string | null
}): Promise<void> {
  try {
    const { db } = await import('@stacksjs/database')
    await db.insertInto(ACTIVITIES_TABLE).values({
      type: payload.type,
      description: payload.description,
      subject_type: payload.subject_type,
      subject_id: payload.subject_id,
      causer: payload.causer,
      properties: payload.properties ? JSON.stringify(payload.properties) : null,
      ip_address: payload.ip_address,
      user_id: payload.user_id,
      created_at: sqlDateTime(),
    } as Record<string, unknown>).executeTakeFirst()
  }
  catch (error) {
    reportTrailFailure('activity', `${payload.subject_type}#${String(payload.subject_id)}`, error)
  }
}

/**
 * Record one lifecycle moment.
 *
 * Exported so the hook builder stays a thin wrapper and this stays testable
 * without a model definition.
 */
export async function recordActivity(context: {
  modelName: string
  event: ActivityEvent
  attributes: Record<string, unknown> | null | undefined
  primaryKey: string
  options: ActivityLogOptions
  hidden?: readonly string[]
}): Promise<void> {
  const { attributes, event, modelName, options, primaryKey } = context
  const id = (attributes?.[primaryKey] as number | string | undefined) ?? null
  const actorId = await resolveTrailActorId()

  await writeActivityRow({
    // `user.created`, matching the event names `observe` dispatches and the
    // shapes the Activity model's own factory generates.
    type: `${modelName.toLowerCase()}.${event}`,
    description: describeActivity(modelName, event, id),
    subject_type: modelName,
    subject_id: id,
    properties: selectLoggedProperties(attributes, options, context.hidden),
    causer: actorId == null ? null : `User:${String(actorId)}`,
    user_id: actorId,
    ip_address: await resolveTrailIp(),
  })
}

/** A value reduced to its bare attribute bag, whatever shape the caller passed. */
function plainAttributes(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object')
    return null

  const candidate = value as { attributes?: Record<string, unknown>, _attributes?: Record<string, unknown> }
  if (candidate.attributes && typeof candidate.attributes === 'object')
    return { ...candidate.attributes }
  if (candidate._attributes && typeof candidate._attributes === 'object')
    return { ...candidate._attributes }
  return { ...(value as Record<string, unknown>) }
}

/**
 * Wire the feed into a model's static surface.
 *
 * Wrapping `create` / `update` / `delete` rather than using the lifecycle
 * hooks, for the reason `applyAudit` does the same: bun-query-builder's
 * `afterUpdate` and `afterDelete` do not fire for the STATIC
 * `Model.update(id, …)` and `Model.delete(id)` paths, which is how most
 * application code writes. Verified before this was written - hooks alone
 * logged the create and silently missed both of the others.
 *
 * `update` and `delete` read the row first, because the feed's whole value is
 * saying what the record was: after an update the model returns the new state,
 * and after a delete there is nothing left to read.
 */
export function applyActivityLog(
  baseModel: Record<string, unknown>,
  modelName: string,
  primaryKey: string,
  options: ActivityLogOptions,
  hidden: readonly string[] = [],
): void {
  // The feed must not describe itself: an Activity row for an Activity write is
  // an unbounded loop through this same wrapper.
  if (modelName === 'Activity')
    return

  const model = baseModel as { find?: (id: number | string) => Promise<unknown> }
  const readRow = async (id: number | string): Promise<Record<string, unknown> | null> =>
    typeof model.find === 'function' ? plainAttributes(await model.find(id)) : null

  const log = async (event: ActivityEvent, attributes: Record<string, unknown> | null): Promise<void> => {
    await recordActivity({ modelName, event, attributes, primaryKey, options, hidden })
  }

  const originalCreate = baseModel.create
  if (typeof originalCreate === 'function') {
    baseModel.create = async function (...args: unknown[]) {
      const result = await (originalCreate as (...a: unknown[]) => unknown).apply(this, args)
      await log('created', plainAttributes(result))
      return result
    }
  }

  const originalUpdate = baseModel.update
  if (typeof originalUpdate === 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      const result = await (originalUpdate as (i: number | string, d: Record<string, unknown>) => unknown).call(this, id, data)
      await log('updated', plainAttributes(result) ?? await readRow(id))
      return result
    }
  }

  const originalDelete = baseModel.delete
  if (typeof originalDelete === 'function') {
    baseModel.delete = async function (id: number | string) {
      // Read BEFORE the delete: afterwards the row is gone and the feed would
      // have nothing to say about what was removed.
      const before = await readRow(id)
      const result = await (originalDelete as (i: number | string) => unknown).call(this, id)
      await log('deleted', before ?? { [primaryKey]: id })
      return result
    }
  }
}
