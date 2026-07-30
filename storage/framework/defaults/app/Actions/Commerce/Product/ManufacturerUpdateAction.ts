import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Update',
  description: 'Updates a manufacturer through the native commerce module.',
  method: 'PATCH',
  model: Manufacturer,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const model = await products.manufacturers.update(id, data)

    return response.json(model)
  },
})
