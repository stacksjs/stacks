import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { anonymizedRows } from '@stacksjs/orm'
import { resolveActionHandler, response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'
import { modelActionApplies, modelActionOutcome, modelActions } from './model-actions'
import { humanizeIdentifier, isErasureSubject, isValidModelSlug, modelSchemaColumns, parseRowId, slugToPascal } from './model-write'

/**
 * `POST /api/dashboard/models/{dashboardModel}/{id}/actions/{dashboardAction}`.
 *
 * Runs one of the actions a model lists under `dashboard.actions` on one of
 * its records. The action is the app's own, under `app/Actions`, and it runs
 * as its own route would: this request is handed to it, so it reads the
 * record's id with `request.getParam('id')` exactly as it would behind
 * `/orders/{id}/ship`, and its `validations`, `authorize` and `before` apply.
 *
 * The other two parameters carry long names on purpose. Route parameters are
 * part of an action's input, and a `slug` or a `name` here would be read by
 * an action that validates a field of that name.
 *
 * Only what the model declares can be run, only on a record that exists, and
 * only when the record meets the action's `when`: the page hides the button
 * for the others, and this is what holds if it is asked anyway.
 */
export default new Action({
  name: 'Dashboard Model Action Run',
  description: 'Runs one of the actions a model lists under dashboard.actions on one of its records.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const slug = String(request.getParam('dashboardModel') ?? '')
    if (!isValidModelSlug(slug))
      return response.json({ message: 'Model slug must be lowercase kebab-case.' }, 400)
    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return response.json({ message: 'A numeric row id is required.' }, 400)

    const modelName = slugToPascal(slug)
    const name = String(request.getParam('dashboardAction') ?? '')
    let Model: any
    let row: unknown
    try {
      Model = await resolveDashboardModel(modelName)
      if (!Model || typeof Model.find !== 'function')
        return response.json({ message: `No ORM model named ${modelName}.` }, 404)
      row = await Model.find(id)
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelName} ${id} could not be loaded.`, 'ModelActionRunAction.load')
    }

    const action = (await modelActions(Model, modelName)).find(candidate => candidate.name === name)
    if (!action)
      return response.json({ message: `${modelName} has no dashboard action named '${name}'.` }, 404)
    if (!row)
      return response.json({ message: `${modelName} ${id} not found.` }, 404)

    const record = humanizeIdentifier(modelName).toLowerCase()
    // An erased account is placeholders: there is nobody left to act on.
    if (isErasureSubject(Model)) {
      const stored = Object.fromEntries(modelSchemaColumns(Model).map(column => [column, safeGet(row, column, null)]))
      const [erased] = await anonymizedRows(modelName, [stored]).catch(() => [false])
      if (erased)
        return response.json({ message: `This ${record} was anonymized, so "${action.label}" has nothing to act on.` }, 409)
    }
    if (!modelActionApplies(action, row))
      return response.json({ message: `"${action.label}" is not available for this ${record} as it is now.` }, 409)

    // Not caught: what the action throws is answered by this route the way
    // the action's own route would answer it, status and message included.
    const handler = await resolveActionHandler(action.handler)
    return modelActionOutcome(await handler(request), action.label)
  },
})
