import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchProductAction',
  description: 'Fetch the product id',
  method: 'GET',
  async handle(request: RequestInstance) {
    const productId = Number(request.getParam('id'))

    const product = await Product.find(productId)

    return response.json(product)
  },
})
