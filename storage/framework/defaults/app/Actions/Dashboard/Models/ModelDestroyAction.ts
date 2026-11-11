import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { eraseSubject, GDPR_SUBJECT_MODEL } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { destroyModelRecord } from './model-destroy'
import { isAccountModel, parseRowId, resolveWritableModel } from './model-write'

/** The id of the account making this request, when there is one. */
async function signedInId(request: RequestInstance): Promise<number | null> {
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
 * `DELETE /api/dashboard/models/{slug}/{id}`.
 *
 * Deletes one row from the dashboard's generic model browser. Goes through
 * the model rather than the table so soft deletes, observers and cascade
 * behaviour all apply exactly as they would anywhere else in the app. A user
 * other records still point at is anonymized instead: see `./model-destroy`.
 */
export default new Action({
  name: 'Dashboard Model Destroy',
  description: 'Deletes one row of a model from the dashboard model browser.',
  method: 'DELETE',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const resolved = await resolveWritableModel(request.getParam('slug'), 'destroy')
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)

    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return response.json({ message: 'A numeric row id is required.' }, 400)

    // Deleting the account you are signed in with ends your own access in the
    // middle of using it, and for the last admin there is no way back in.
    const viewer = await signedInId(request)
    if (isAccountModel(resolved.Model) && viewer === id)
      return response.json({ message: 'You are signed in with this account, so it cannot be deleted from here. Ask another admin to remove it.' }, 409)

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
      return response.json({ message: `${resolved.modelName} ${id} not found.` }, 404)
    // The database kept the row because others still point at it. Nothing
    // failed: the answer is to deal with those records first, and saying
    // "could not be deleted" sent people to the server logs for it.
    if (result.reason === 'referenced')
      return response.json({ message: `This ${resolved.modelName.toLowerCase()} cannot be deleted while other records still refer to it. Remove or reassign those records first.` }, 409)
    // Erasure is one transaction and repeating it changes nothing it already
    // changed, so "try again" is a real answer here.
    if (result.reason === 'erasure-failed')
      return dashboardOperationalError(result.cause, 'Other records still refer to this user, and anonymizing the account did not finish. Try again: repeating it is safe.', 'ModelDestroyAction.erase', 500)
    return dashboardOperationalError(result.cause, 'The model record could not be deleted.', 'ModelDestroyAction', 500)
  },
})
