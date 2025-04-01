import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Order Index',
  description: 'Order Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Order.all()

    return response.json(results)
  },
})
