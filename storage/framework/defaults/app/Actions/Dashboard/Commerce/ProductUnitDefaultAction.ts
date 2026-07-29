import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnitDefaultAction',
  description: 'Atomically updates the default product unit for a unit type.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const isDefault = request.boolean('isDefault')
    if (!Number.isFinite(id) || id <= 0)
      return response.notFound({ error: 'Product unit not found' })

    const updated = await products.units.updateDefaultStatus(id, isDefault)
    if (!updated)
      return response.notFound({ error: 'Product unit not found' })

    return { success: true, id: String(id), isDefault }
  },
})
