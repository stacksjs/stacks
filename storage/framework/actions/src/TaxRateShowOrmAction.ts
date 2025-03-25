import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Show',
  description: 'TaxRate Show ORM Action',
  method: 'GET',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam('id')

    const model = await TaxRate.findOrFail(Number(id))

    return response.json(model)
  },
})
