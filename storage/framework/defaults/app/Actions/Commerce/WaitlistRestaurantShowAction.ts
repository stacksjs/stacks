import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Show',
  description: 'WaitlistRestaurant Show ORM Action',
  method: 'GET',
  async handle(request: WaitlistRestaurantRequestType) {
    const id = request.getParam('id')

    const model = await waitlists.restaurant.fetchById(id)

    return response.json(model)
  },
})
