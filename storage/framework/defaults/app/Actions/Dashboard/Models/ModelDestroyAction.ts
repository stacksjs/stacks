import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { destroyModelRow, requestAccountId, rowRefusalResponse } from './model-row-writes'
import { parseRowKey, resolveWritableModel } from './model-write'

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

    // The model's own key: a number, or the value of one it declares (stacksjs/stacks#3350).
    const id = parseRowKey(resolved.Model, request.getParam('id'))
    if (id === null)
      return response.json({ message: resolved.Model?.autoIncrement === false ? 'A row key is required.' : 'A numeric row id is required.' }, 400)

    const result = await destroyModelRow(resolved, id, await requestAccountId(request))
    return result.ok ? { ok: true, id, anonymized: result.anonymized } : rowRefusalResponse(result)
  },
})
