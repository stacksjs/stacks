import type { ProductUnitRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Store',
  description: 'ProductUnit Store ORM Action',
  method: 'POST',
  async handle(request: ProductUnitRequestType) {
    await request.validate()
    const model = await ProductUnit.create(request.all())

    return response.json(model)
  },
})
