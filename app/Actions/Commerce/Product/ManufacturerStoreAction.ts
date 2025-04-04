import type { ManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Store',
  description: 'Manufacturer Store ORM Action',
  method: 'POST',
  async handle(request: ManufacturerRequestType) {
    const model = await products.manufacturers.store(request)

    return response.json(model)
  },
})
