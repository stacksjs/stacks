import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { formFields, rowRefusalResponse, updateModelRow } from './model-row-writes'
import { parseRowKey, resolveWritableModel } from './model-write'

interface ModelWriteInput {
  fields?: unknown
}

/**
 * `PATCH /api/dashboard/models/{slug}/{id}`.
 *
 * Edits one row from the dashboard's generic model browser. The page's
 * edit control used to be decorative — a button with no handler — which is
 * worse than having none, because the row reads as manageable and silently
 * is not.
 */
export default new Action({
  name: 'Dashboard Model Update',
  description: 'Updates one row of a model from the dashboard model browser.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance<ModelWriteInput>) {
    const resolved = await resolveWritableModel(request.getParam('slug'), 'update')
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)

    // The model's own key: a number, or the value of one it declares (stacksjs/stacks#3350).
    const id = parseRowKey(resolved.Model, request.getParam('id'))
    if (id === null)
      return response.json({ message: resolved.Model?.autoIncrement === false ? 'A row key is required.' : 'A numeric row id is required.' }, 400)

    // Nested under `fields`, apart from the URL's params (see `formFields`).
    const result = await updateModelRow(resolved, id, formFields(request.all().fields))
    return result.ok ? { ok: true, id, changed: result.changed } : rowRefusalResponse(result)
  },
})
