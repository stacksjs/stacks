import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { isUniqueViolation, ModelValidationError, toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { missingRelationErrors } from './model-relations'
import { planSwitches, requestedSwitches, storedSwitches } from './model-switches'
import { duplicateFieldErrors, humanizeIdentifier, parseRowId, prepareModelFields, resolveWritableModel } from './model-write'

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

    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return response.json({ message: 'A numeric row id is required.' }, 400)

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
      return response.json({ message: 'Validation failed.', errors: prepared.errors }, 422)
    const changes = toSnakeCaseKeys(prepared.data)
    // What a trait keeps for itself (a confirmed email, two-factor) is asked
    // for as a switch and changed by the trait's own function.
    const { asked, errors: unreadable } = requestedSwitches(resolved.Model, body)
    if (Object.keys(unreadable).length > 0)
      return response.json({ message: 'Validation failed.', errors: unreadable }, 422)
    if (Object.keys(changes).length === 0 && asked.length === 0)
      return response.json({ message: 'No writable fields in the request body.' }, 422)

    try {
      const row = await resolved.Model.find(id)
      if (!row)
        return response.json({ message: `${resolved.modelName} ${id} not found.` }, 404)
      // Refused before anything is written: a switch that cannot be turned
      // that way refuses the whole save, like any other field's rule.
      const { turning, errors } = planSwitches(resolved.Model, asked, asked.length > 0 ? await storedSwitches(resolved.Model, id) : {})
      if (Object.keys(errors).length > 0)
        return response.json({ message: 'Validation failed.', errors }, 422)
      if (Object.keys(changes).length > 0)
        await resolved.Model.update(id, changes)
      for (const request of turning)
        await request.switch.set(id, request.on)
      return { ok: true, id, changed: [...Object.keys(changes), ...turning.map(request => request.switch.column)] }
    }
    catch (error) {
      // The model's own rules rejected the row: the caller's mistake, named
      // field by field, not a server failure (stacksjs/stacks#3007).
      if (error instanceof ModelValidationError)
        return response.json({ message: 'Validation failed.', errors: error.errors }, 422)
      // A value another row already holds, on a field the model marks unique
      // (a user's email). The person can fix that, so it is named on the field
      // like any other rule, not reported as a failed save.
      if (isUniqueViolation(error)) {
        const errors = duplicateFieldErrors(resolved.Model, Object.keys(changes))
        if (Object.keys(errors).length > 0)
          return response.json({ message: 'Validation failed.', errors }, 422)
      }
      // A record this one points at was deleted while the form was open. The
      // person can pick another, so it is said on that field.
      const missing = missingRelationErrors(resolved.Model, error, Object.keys(changes), humanizeIdentifier)
      if (Object.keys(missing).length > 0)
        return response.json({ message: 'Validation failed.', errors: missing }, 422)
      return dashboardOperationalError(error, 'The model record could not be updated.', 'ModelUpdateAction', 500)
    }
  },
})
