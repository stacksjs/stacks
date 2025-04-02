import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Index',
  description: 'Review Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.reviews.fetchAll()

    return response.json(results)
  },
})
