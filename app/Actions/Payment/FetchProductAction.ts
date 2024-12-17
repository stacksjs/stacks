import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import Product from '../../../storage/framework/orm/src/models/Product.ts'

export default new Action({
  name: 'FetchProductAction',
  description: 'Fetch the product id',
  method: 'GET',
  async handle(request: RequestInstance) {
    const productId = Number(request.getParam('id'))

    const product = await Product.find(productId)

    return product
  },
})
