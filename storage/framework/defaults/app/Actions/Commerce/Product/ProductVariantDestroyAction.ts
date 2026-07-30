import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Destroy',
  description: 'Deletes a product variant through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await products.variants.destroy(id)

    return response.noContent()
  },
})
