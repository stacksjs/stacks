import { Action } from '@stacksjs/actions'
import { parseRowId, resolveWritableModel } from './model-write'

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
  async handle(req: { getParam?: (name: string) => unknown, route?: { params?: { slug?: string, id?: string } } }) {
    const resolved = await resolveWritableModel(String(req?.getParam?.('slug') ?? req?.route?.params?.slug ?? ''), 'destroy')
    if ('error' in resolved)
      return { ok: false, error: resolved.error }

    const id = parseRowId(req?.getParam?.('id') ?? req?.route?.params?.id)
    if (id === null)
      return { ok: false, error: 'A numeric row id is required.' }

    try {
      const row = await resolved.Model.find(id)
      if (!row)
        return { ok: false, error: `${resolved.modelName} ${id} not found.` }
      await row.delete()
      return { ok: true, id }
    }
    catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
})
