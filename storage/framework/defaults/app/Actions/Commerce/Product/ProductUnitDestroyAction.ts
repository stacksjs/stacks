import type { ProductUnitRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Destroy',
  description: 'ProductUnit Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ProductUnitRequestType) {
    const id = request.getParam('id')

    await products.units.destroy(id)

    return response.json({ message: 'Unit deleted successfully' })
  },
})
