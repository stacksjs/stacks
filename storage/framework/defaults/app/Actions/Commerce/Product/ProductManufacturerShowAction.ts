import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Show',
  description: 'ProductManufacturer Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await products.manufacturers.fetchById(id)

    return response.json(model)
  },
})
