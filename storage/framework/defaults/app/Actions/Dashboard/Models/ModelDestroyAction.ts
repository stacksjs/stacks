import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { destroyModelRow, requestAccountId, rowRefusalResponse } from './model-row-writes'
import { parseRowId, resolveWritableModel } from './model-write'

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

    const result = await destroyModelRow(resolved, id, await requestAccountId(request))
    return result.ok ? { ok: true, id, anonymized: result.anonymized } : rowRefusalResponse(result)
  },
})
