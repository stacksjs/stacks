import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintLog Index',
  description: 'PrintLog Index ORM Action',
  method: 'GET',
  async handle() {
    const results = PrintLog.all()

    return response.json(results)
  },
})
