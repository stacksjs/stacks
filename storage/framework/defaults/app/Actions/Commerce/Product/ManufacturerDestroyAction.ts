import type { ManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Destroy',
  description: 'Manufacturer Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ManufacturerRequestType) {
    const id = request.getParam('id')

    await products.manufacturers.destroy(id)

    return response.json({
      message: 'Manufacturer deleted successfully',
    })
  },
})
