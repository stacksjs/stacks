import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Store',
  description: 'ProductVariant Store ORM Action',
  method: 'POST',
  async handle(request: ProductVariantRequestType) {
    const model = await products.variants.store(request)

    return response.json(model)
  },
})
