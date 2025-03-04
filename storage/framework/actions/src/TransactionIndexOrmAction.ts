import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Transaction Index',
  description: 'Transaction Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Transaction.all()

    return response.json(results)
  },
})
