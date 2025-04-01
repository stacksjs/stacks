import type { ManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Show',
  description: 'Manufacturer Show ORM Action',
  method: 'GET',
  async handle(request: ManufacturerRequestType) {
    const id = request.getParam('id')

    const model = await Manufacturer.findOrFail(Number(id))

    return response.json(model)
  },
})
