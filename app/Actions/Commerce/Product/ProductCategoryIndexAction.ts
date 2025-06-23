import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Category Index',
  description: 'Product Category Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.categories.fetchAll()

    return response.json(results)
  },
})
