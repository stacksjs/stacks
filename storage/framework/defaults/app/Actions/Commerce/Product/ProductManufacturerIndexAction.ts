import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Index',
  description: 'ProductManufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.manufacturers.fetchAll()

    return response.json(results)
  },
})
