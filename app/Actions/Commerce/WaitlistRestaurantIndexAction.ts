import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Index',
  description: 'WaitlistRestaurant Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await waitlists.restaurant.fetchAll()

    return response.json(results)
  },
})
