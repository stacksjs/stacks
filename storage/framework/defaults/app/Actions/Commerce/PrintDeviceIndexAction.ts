import { Action } from '@stacksjs/actions'
import { devices } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Index',
  description: 'PrintDevice Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await devices.fetchAll()

    return response.json(results)
  },
})
