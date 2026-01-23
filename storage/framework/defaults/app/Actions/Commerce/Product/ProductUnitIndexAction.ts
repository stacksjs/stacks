import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Index',
  description: 'ProductUnit Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.units.fetchAll()

    return response.json(results)
  },
})
