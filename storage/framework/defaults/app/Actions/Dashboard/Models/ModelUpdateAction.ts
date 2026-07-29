import { Action } from '@stacksjs/actions'
import { request } from '@stacksjs/router'
import { parseRowId, PROTECTED_COLUMNS, resolveWritableModel } from './model-write'

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
  async handle(req: {
    getParam?: (name: string) => unknown
    all?: () => Record<string, unknown>
    route?: { params?: { slug?: string, id?: string } }
  }) {
    const resolved = await resolveWritableModel(String(req?.getParam?.('slug') ?? req?.route?.params?.slug ?? ''))
    if ('error' in resolved)
      return { ok: false, error: resolved.error }

    const id = parseRowId(req?.getParam?.('id') ?? req?.route?.params?.id)
    if (id === null)
      return { ok: false, error: 'A numeric row id is required.' }

    // Edits arrive nested under `fields`. The router's input bag merges the
    // body with route params and query, so a flat payload would silently
    // pick up the `slug` and `id` from the URL and try to write them as
    // columns — and `slug` is a real column on plenty of models, so it
    // cannot simply be blocklisted. One level of nesting keeps the two
    // namespaces apart.
    const input = (req.all?.() ?? (request as any).all?.() ?? {}) as Record<string, unknown>
    const raw = input.fields
    const body = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {}
    const changes: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!/^\w+$/.test(key) || PROTECTED_COLUMNS.has(key)) continue
      changes[key] = value
    }
    if (Object.keys(changes).length === 0)
      return { ok: false, error: 'No writable fields in the request body.' }

    try {
      const row = await resolved.Model.find(id)
      if (!row)
        return { ok: false, error: `${resolved.modelName} ${id} not found.` }
      await row.update(changes)
      return { ok: true, id, changed: Object.keys(changes) }
    }
    catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
})
