import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Update',
  description: 'TaxRate Update ORM Action',
  method: 'PATCH',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam('id')
    const model = await tax.update(id, request)

    return response.json(model)
  },
})
