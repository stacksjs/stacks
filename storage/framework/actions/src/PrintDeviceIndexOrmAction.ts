import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Index',
  description: 'PrintDevice Index ORM Action',
  method: 'GET',
  async handle() {
    const results = PrintDevice.all()

    return response.json(results)
  },
})
