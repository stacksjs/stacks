import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRateDefaultAction',
  description: 'Atomically selects the default tax rate.',
  method: 'PATCH',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const isDefault = request.boolean('isDefault')
    if (!Number.isFinite(id) || id <= 0)
      return response.notFound({ error: 'Tax rate not found' })

    const updated = await tax.updateDefaultStatus(id, isDefault)
    if (!updated)
      return response.notFound({ error: 'Tax rate not found' })

    return { success: true, id: String(id), isDefault }
  },
})
