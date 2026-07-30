import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Destroy',
  description: 'Deletes a product unit through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await products.units.destroy(id)

    return response.noContent()
  },
})
