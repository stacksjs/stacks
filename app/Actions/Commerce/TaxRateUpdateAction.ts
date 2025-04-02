import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Update',
  description: 'TaxRate Update ORM Action',
  method: 'PATCH',
  async handle(request: TaxRateRequestType) {
    await request.validate()

    const id = request.getParam<number>('id')
    const model = await TaxRate.findOrFail(id)

    const result = model.update(request.all())

    return response.json(result)
  },
})
