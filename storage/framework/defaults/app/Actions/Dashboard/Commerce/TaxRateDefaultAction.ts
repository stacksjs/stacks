import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'TaxRateDefaultAction',
  description: 'Atomically selects the default tax rate.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ error: 'A valid tax rate id is required.' }, 400)
    if (typeof request.get('isDefault') !== 'boolean')
      return response.json({ error: 'isDefault must be a boolean.' }, 422)
    const isDefault = request.boolean('isDefault')

    let updated
    try {
      updated = await tax.updateDefaultStatus(id, isDefault)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Tax rate default could not be updated.', 'TaxRateDefaultAction', 500)
    }
    if (!updated)
      return response.notFound({ error: 'Tax rate not found' })

    return { success: true, id: String(id), isDefault }
  },
})
