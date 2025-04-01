import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Customer Index',
  description: 'Customer Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Customer.all()

    return response.json(results)
  },
})
