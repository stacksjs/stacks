import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { parseRowId, prepareModelFields, resolveWritableModel } from './model-write'

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
      return { ok: false, error: resolved.error }

    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return { ok: false, error: 'A numeric row id is required.' }

    // Edits arrive nested under `fields`. The router's input bag merges the
    // body with route params and query, so a flat payload would silently
    // pick up the `slug` and `id` from the URL and try to write them as
    // columns — and `slug` is a real column on plenty of models, so it
    // cannot simply be blocklisted. One level of nesting keeps the two
    // namespaces apart.
    const input = request.all()
    const raw = input.fields
    const body = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {}
    const prepared = prepareModelFields(resolved.Model, body, true)
    if (Object.keys(prepared.errors).length > 0)
      return { ok: false, error: 'Validation failed.', errors: prepared.errors }
    const changes = toSnakeCaseKeys(prepared.data)
    if (Object.keys(changes).length === 0)
      return { ok: false, error: 'No writable fields in the request body.' }

    try {
      const row = await resolved.Model.find(id)
      if (!row)
        return { ok: false, error: `${resolved.modelName} ${id} not found.` }
      await resolved.Model.update(id, changes)
      return { ok: true, id, changed: Object.keys(changes) }
    }
    catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
})
