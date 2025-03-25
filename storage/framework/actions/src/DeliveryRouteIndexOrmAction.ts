import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'DeliveryRoute Index',
  description: 'DeliveryRoute Index ORM Action',
  method: 'GET',
  async handle() {
    const results = DeliveryRoute.all()

    return response.json(results)
  },
})
