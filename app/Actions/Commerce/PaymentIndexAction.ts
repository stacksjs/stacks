import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Index',
  description: 'Payment Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Payment.all()

    return response.json(results)
  },
})
