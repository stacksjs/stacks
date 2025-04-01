import { Action } from '@stacksjs/actions'

import { manufacturer } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Manufacturer Index',
  description: 'Manufacturer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await manufacturer.fetchWithProductCount()

    return response.json(results)
  },
})
