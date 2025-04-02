import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Index',
  description: 'ProductVariant Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.variants.fetchAll()

    return response.json(results)
  },
})
