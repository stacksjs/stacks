import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Index',
  description: 'Manufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.manufacturers.fetchWithProductCount()

    return response.json(results)
  },
})
