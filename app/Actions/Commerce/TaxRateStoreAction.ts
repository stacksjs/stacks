import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Store',
  description: 'TaxRate Store ORM Action',
  method: 'POST',
  async handle(request: TaxRateRequestType) {
    const model = await tax.store(request)

    return response.json(model)
  },
})
