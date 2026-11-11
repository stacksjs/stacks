import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'
import { relatedPanels } from './model-related'
import { isValidModelSlug, parseRowId, slugToPascal } from './model-write'

/**
 * `GET /api/dashboard/models/{slug}/{id}/related`.
 *
 * The records that point at one record, as the panels of its page: for each
 * `hasMany` and `hasOne` the model declares, a count and the newest few. See
 * `./model-related`.
 */
export default new Action({
  name: 'Dashboard Model Related',
  description: 'Lists the records that point at one record, by the model\'s hasMany and hasOne.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const slug = String(request.getParam('slug') ?? '')
    if (!isValidModelSlug(slug))
      return response.json({ message: 'Model slug must be lowercase kebab-case.' }, 400)
    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return response.json({ message: 'A numeric row id is required.' }, 400)

    const modelName = slugToPascal(slug)
    try {
      const Model = await resolveDashboardModel(modelName)
      if (!Model || typeof Model.find !== 'function')
        return response.json({ message: `No ORM model named ${modelName}.` }, 404)
      if (!(await Model.find(id)))
        return response.json({ message: `${modelName} ${id} not found.` }, 404)
      return { panels: await relatedPanels(Model, modelName, id) }
    }
    catch (error) {
      return dashboardOperationalError(error, 'The related records could not be loaded.', 'ModelRelatedAction')
    }
  },
})
