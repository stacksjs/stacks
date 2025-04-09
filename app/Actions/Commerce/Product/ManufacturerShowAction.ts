import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { request, response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Show',
  description: 'Manufacturer Show ORM Action',
  method: 'GET',
  async handle() {
    const id = request.getParam('id')

    const model = await products.manufacturers.fetchById(id)

    return response.json(model)
  },
})
