import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Store',
  description: 'TaxRate Store ORM Action',
  method: 'POST',
  async handle(request: TaxRateRequestType) {
    await request.validate()
    const model = await TaxRate.create(request.all())

    return response.json(model)
  },
})
