import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'ProductUnitDefaultAction',
  description: 'Atomically updates the default product unit for a unit type.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ error: 'A valid product unit id is required.' }, 400)
    if (typeof request.get('isDefault') !== 'boolean')
      return response.json({ error: 'isDefault must be a boolean.' }, 422)
    const isDefault = request.boolean('isDefault')

    let updated
    try {
      updated = await products.units.updateDefaultStatus(id, isDefault)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product unit default could not be updated.', 'ProductUnitDefaultAction', 500)
    }
    if (!updated)
      return response.notFound({ error: 'Product unit not found' })

    return { success: true, id: String(id), isDefault }
  },
})
