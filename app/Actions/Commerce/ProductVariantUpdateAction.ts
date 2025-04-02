import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Update',
  description: 'ProductVariant Update ORM Action',
  method: 'PATCH',
  async handle(request: ProductVariantRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const result = await products.variants.update(Number(id), request)

    return response.json(result)
  },
})
