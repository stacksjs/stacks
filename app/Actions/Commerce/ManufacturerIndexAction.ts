import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Index',
  description: 'Manufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await products.manufacturer.fetchWithProductCount()

    return response.json(results)
  },
})
