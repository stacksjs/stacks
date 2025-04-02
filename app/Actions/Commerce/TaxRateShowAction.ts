import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { TaxRate } from '@stacksjs/orm'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Show',
  description: 'TaxRate Show ORM Action',
  method: 'GET',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam<number>('id')

    const model = await TaxRate.findOrFail(id)

    return response.json(model)
  },
})
