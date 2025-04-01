import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Show',
  description: 'ProductVariant Show ORM Action',
  method: 'GET',
  async handle(request: ProductVariantRequestType) {
    const id = request.getParam('id')

    const model = await ProductVariant.findOrFail(Number(id))

    return response.json(model)
  },
})
