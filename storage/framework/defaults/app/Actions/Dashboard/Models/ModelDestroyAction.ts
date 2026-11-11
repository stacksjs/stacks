import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { isForeignKeyViolation } from '@stacksjs/error-handling'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseRowId, resolveWritableModel } from './model-write'

/** Whether rows of this model are the accounts people sign in with. */
function isAccountModel(Model: any): boolean {
  const traits = Model?.traits ?? {}
  return Boolean(traits.useAuth ?? traits.authenticatable)
}

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
 * behaviour all apply exactly as they would anywhere else in the app.
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
    if (isAccountModel(resolved.Model) && await signedInId(request) === id)
      return response.json({ message: 'You are signed in with this account, so it cannot be deleted from here. Ask another admin to remove it.' }, 409)

    try {
      const row = await resolved.Model.find(id)
      if (!row)
        return response.json({ message: `${resolved.modelName} ${id} not found.` }, 404)
      await row.delete()
      return { ok: true, id }
    }
    catch (error) {
      // The database kept the row because others still point at it. Nothing
      // failed: the answer is to deal with those records first, and saying
      // "could not be deleted" sent people to the server logs for it.
      if (isForeignKeyViolation(error))
        return response.json({ message: `This ${resolved.modelName.toLowerCase()} cannot be deleted while other records still refer to it. Remove or reassign those records first.` }, 409)
      return dashboardOperationalError(error, 'The model record could not be deleted.', 'ModelDestroyAction', 500)
    }
  },
})
