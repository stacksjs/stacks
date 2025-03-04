import type { ProductCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductCategory Show',
  description: 'ProductCategory Show ORM Action',
  method: 'GET',
  async handle(request: ProductCategoryRequestType) {
    const id = request.getParam('id')

    const model = await ProductCategory.findOrFail(Number(id))

    return response.json(model)
  },
})
