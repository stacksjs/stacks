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

    const data = {
      name: request.get('name'),
      rate: request.get<number>('rate'),
      type: request.get('type'),
      country: request.get('country'),
      region: request.get('region'),
    }

    const model = await tax.update(id, data)

    return response.json(model)
  },
})
