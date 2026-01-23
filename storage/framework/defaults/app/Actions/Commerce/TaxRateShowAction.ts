import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Show',
  description: 'TaxRate Show ORM Action',
  method: 'GET',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam('id')

    const model = await tax.fetchById(id)

    return response.json(model)
  },
})
