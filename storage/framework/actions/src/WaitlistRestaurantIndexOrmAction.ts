import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Index',
  description: 'WaitlistRestaurant Index ORM Action',
  method: 'GET',
  async handle() {
    const results = WaitlistRestaurant.all()

    return response.json(results)
  },
})
