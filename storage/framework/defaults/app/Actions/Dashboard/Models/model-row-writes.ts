/**
 * One row created, edited or deleted from the dashboard, as an outcome
 * rather than a response.
 *
 * The create, edit and delete endpoints each answer for one row. Saving a
 * record and its related rows together runs the same steps several times
 * inside one transaction, and has to stop at the first refusal and say where
 * it was. So the steps live here, each returning what happened, and every
 * endpoint turns that into its answer the same way (`rowRefusalResponse`).
 * Every rule a single save has applies to each row of a combined one.
 */
import type { ResponseStatus } from '@stacksjs/bun-router'
import type { RequestInstance } from '@stacksjs/types'
import { eraseSubject, GDPR_SUBJECT_MODEL, isUniqueViolation, ModelValidationError, toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { destroyModelRecord } from './model-destroy'
import { missingRelationErrors } from './model-relations'
import { planSwitches, requestedSwitches, storedSwitches } from './model-switches'
import type { ResolvedModel } from './model-write'
import { duplicateFieldErrors, humanizeIdentifier, isAccountModel, prepareModelFields } from './model-write'

/** Why a row was not written: what the visitor is told, and for a failure, what went wrong. */
export interface RowRefusal {
  ok: false
  status: ResponseStatus
  message: string
  /** The model's own words, field by field. */
  errors?: Record<string, string[]>
  /** A failure of the server rather than of the input: logged, and answered as one. */
  cause?: unknown
  /** Where it failed, for the log line. Set on a failure, never on a refusal. */
  where?: string
}

export type RowWrite<T> = ({ ok: true } & T) | RowRefusal

function refused(status: ResponseStatus, message: string, errors?: Record<string, string[]>): RowRefusal {
  return { ok: false, status, message, ...(errors ? { errors } : {}) }
}

function failed(cause: unknown, message: string, where: string): RowRefusal {
  return { ok: false, status: 500, message, cause, where }
}

/** The refusals a person can act on, read out of an error a write threw. */
function fieldRefusal(resolved: ResolvedModel, error: unknown, columns: string[]): RowRefusal | null {
  // The model's own rules rejected the row: the caller's mistake, named
  // field by field, not a server failure (stacksjs/stacks#3007).
  if (error instanceof ModelValidationError)
    return refused(422, 'Validation failed.', error.errors)
  // A value another row already holds, on a field the model marks unique (a
  // user's email) or a pair a unique index covers (a team member's team and
  // user), whether the row is new or edited. The person can fix that, so it
  // is named on the field like any other rule, not reported as a failed save.
  if (isUniqueViolation(error)) {
    const errors = duplicateFieldErrors(resolved.Model, columns, error)
    if (Object.keys(errors).length > 0)
      return refused(422, 'Validation failed.', errors)
  }
  // A record this one points at was deleted while the form was open. The
  // person can pick another, so it is said on that field.
  const missing = missingRelationErrors(resolved.Model, error, columns, humanizeIdentifier)
  if (Object.keys(missing).length > 0)
    return refused(422, 'Validation failed.', missing)
  return null
}

/**
 * The fields a form sent. Edits arrive nested under `fields`: the router's
 * input bag merges the body with route params and query, so a flat payload
 * would pick up the `slug` and `id` from the URL and try to write them as
 * columns, and `slug` is a real column on plenty of models.
 */
export function formFields(raw: unknown): Record<string, unknown> {
  return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {}
}

/** Create one row. `fixed` are columns set by where it is created, not by the form: a related row's link back. */
export async function storeModelRow(resolved: ResolvedModel, body: Record<string, unknown>, fixed: Record<string, unknown> = {}): Promise<RowWrite<{ id: unknown }>> {
  const { data, errors } = prepareModelFields(resolved.Model, body)
  if (Object.keys(errors).length > 0)
    return refused(422, 'Validation failed.', errors)
  if (Object.keys(data).length === 0)
    return refused(422, 'No fillable fields in the request body.')

  const values = { ...toSnakeCaseKeys(data), ...fixed }
  try {
    const row = await resolved.Model.create(values)
    return { ok: true, id: row?.id ?? row?.attributes?.id ?? null }
  }
  catch (error) {
    return fieldRefusal(resolved, error, Object.keys(values))
      ?? failed(error, 'The model record could not be created.', 'ModelStoreAction')
  }
}

/** Edit one row with the fields that changed, and the switches a trait keeps for itself. */
export async function updateModelRow(resolved: ResolvedModel, id: number, body: Record<string, unknown>): Promise<RowWrite<{ id: number, changed: string[] }>> {
  const prepared = prepareModelFields(resolved.Model, body, true)
  if (Object.keys(prepared.errors).length > 0)
    return refused(422, 'Validation failed.', prepared.errors)
  const changes = toSnakeCaseKeys(prepared.data)
  // What a trait keeps for itself (a confirmed email, two-factor) is asked
  // for as a switch and changed by the trait's own function.
  const { asked, errors: unreadable } = requestedSwitches(resolved.Model, body)
  if (Object.keys(unreadable).length > 0)
    return refused(422, 'Validation failed.', unreadable)
  if (Object.keys(changes).length === 0 && asked.length === 0)
    return refused(422, 'No writable fields in the request body.')

  try {
    const row = await resolved.Model.find(id)
    if (!row)
      return refused(404, `${resolved.modelName} ${id} not found.`)
    // Refused before anything is written: a switch that cannot be turned
    // that way refuses the whole save, like any other field's rule.
    const { turning, errors } = planSwitches(resolved.Model, asked, asked.length > 0 ? await storedSwitches(resolved.Model, id) : {})
    if (Object.keys(errors).length > 0)
      return refused(422, 'Validation failed.', errors)
    if (Object.keys(changes).length > 0)
      await resolved.Model.update(id, changes)
    for (const request of turning)
      await request.switch.set(id, request.on)
    return { ok: true, id, changed: [...Object.keys(changes), ...turning.map(request => request.switch.column)] }
  }
  catch (error) {
    return fieldRefusal(resolved, error, Object.keys(changes))
      ?? failed(error, 'The model record could not be updated.', 'ModelUpdateAction')
  }
}

/** The id of the account making this request, when there is one. */
export async function requestAccountId(request: RequestInstance): Promise<number | null> {
  try {
    const id = Number((await request.user())?.id)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  }
  catch {
    // The local dashboard runs without a session, and then there is no
    // account to protect.
    return null
  }
}

/**
 * Delete one row through the model, so soft deletes, observers and cascades
 * apply. A user other records still point at is anonymized instead: see
 * `./model-destroy`. `viewer` is the account making the request, which is
 * not deleted from here.
 */
export async function destroyModelRow(resolved: ResolvedModel, id: number, viewer: number | null): Promise<RowWrite<{ id: number, anonymized: boolean }>> {
  // Deleting the account you are signed in with ends your own access in the
  // middle of using it, and for the last admin there is no way back in.
  if (isAccountModel(resolved.Model) && viewer === id)
    return refused(409, 'You are signed in with this account, so it cannot be deleted from here. Ask another admin to remove it.')

  const result = await destroyModelRecord(id, {
    Model: resolved.Model,
    actor: viewer === null ? 'dashboard' : `dashboard:user:${viewer}`,
    erase: async (subject, actor) => {
      const erased = await eraseSubject(subject, { actor })
      const own = erased.changes.find(change => change.model === GDPR_SUBJECT_MODEL)
      return { action: (own?.action ?? 'keep') as 'anonymize' | 'delete' | 'keep' }
    },
  })

  if (result.ok)
    return { ok: true, id, anonymized: result.outcome === 'anonymized' }
  if (result.reason === 'missing')
    return refused(404, `${resolved.modelName} ${id} not found.`)
  // The database kept the row because others still point at it. Nothing
  // failed: the answer is to deal with those records first, and saying
  // "could not be deleted" sent people to the server logs for it.
  if (result.reason === 'referenced')
    return refused(409, `This ${resolved.modelName.toLowerCase()} cannot be deleted while other records still refer to it. Remove or reassign those records first.`)
  // Erasure is one transaction and repeating it changes nothing it already
  // changed, so "try again" is a real answer here.
  if (result.reason === 'erasure-failed')
    return failed(result.cause, 'Other records still refer to this user, and anonymizing the account did not finish. Try again: repeating it is safe.', 'ModelDestroyAction.erase')
  return failed(result.cause, 'The model record could not be deleted.', 'ModelDestroyAction')
}

/** A refusal as an endpoint answers it: the visitor's words, or a logged failure of the server. */
export function rowRefusalResponse(refusal: RowRefusal): Response {
  if (refusal.where)
    return dashboardOperationalError(refusal.cause, refusal.message, refusal.where, refusal.status)
  return response.json({ message: refusal.message, ...(refusal.errors ? { errors: refusal.errors } : {}) }, refusal.status)
}
