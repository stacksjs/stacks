import type { ProductManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Store',
  description: 'ProductManufacturer Store ORM Action',
  method: 'POST',
  async handle(request: ProductManufacturerRequestType) {
    await request.validate()
    const model = await ProductManufacturer.create(request.all())

    return response.json(model)
  },
})
