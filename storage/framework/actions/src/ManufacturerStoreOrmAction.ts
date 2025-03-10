import type { ManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Store',
  description: 'Manufacturer Store ORM Action',
  method: 'POST',
  async handle(request: ManufacturerRequestType) {
    await request.validate()
    const model = await Manufacturer.create(request.all())

    return response.json(model)
  },
})
