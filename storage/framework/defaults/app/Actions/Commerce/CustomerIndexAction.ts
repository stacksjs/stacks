import { Action } from '@stacksjs/actions'
import { customers } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Index',
  description: 'Customer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await customers.fetchAll()

    return response.json(results)
  },
})
