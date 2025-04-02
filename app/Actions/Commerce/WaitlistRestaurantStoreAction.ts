import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Store',
  description: 'WaitlistRestaurant Store ORM Action',
  method: 'POST',
  async handle(request: WaitlistRestaurantRequestType) {
    const model = await waitlists.restaurant.store(request)

    return response.json(model)
  },
})
