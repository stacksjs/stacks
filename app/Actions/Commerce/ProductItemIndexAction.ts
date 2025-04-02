import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Index',
  description: 'ProductItem Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.items.fetchAll()

    return response.json(results)
  },
})
