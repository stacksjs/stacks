import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Store',
  description: 'ProductVariant Store ORM Action',
  method: 'POST',
  async handle(request: ProductVariantRequestType) {
    await request.validate()
    const model = await ProductVariant.create(request.all())

    return response.json(model)
  },
})
