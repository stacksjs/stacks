import { Action } from '@stacksjs/actions/runtime'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Store',
  description: 'Creates a manufacturer through the native commerce module.',
  method: 'POST',
  model: Manufacturer,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await products.manufacturers.store(data)

    return response.json(model)
  },
})
