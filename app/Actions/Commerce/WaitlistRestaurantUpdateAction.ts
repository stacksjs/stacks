import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Update',
  description: 'WaitlistRestaurant Update ORM Action',
  method: 'PATCH',
  async handle(request: WaitlistRestaurantRequestType) {
    const id = request.getParam<number>('id')
    const model = await waitlists.restaurant.update(id, request)

    return response.json(model)
  },
})
