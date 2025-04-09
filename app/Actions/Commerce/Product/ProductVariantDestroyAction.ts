import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Destroy',
  description: 'ProductVariant Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ProductVariantRequestType) {
    const id = request.getParam('id')

    await products.variants.destroy(id)

    return response.json({ message: 'Variant deleted successfully' })
  },
})
