import type { ProductCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductCategory Store',
  description: 'ProductCategory Store ORM Action',
  method: 'POST',
  async handle(request: ProductCategoryRequestType) {
    await request.validate()
    const model = await ProductCategory.create(request.all())

    return response.json(model)
  },
})
