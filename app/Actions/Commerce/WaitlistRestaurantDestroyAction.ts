import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Destroy',
  description: 'WaitlistRestaurant Destroy ORM Action',
  method: 'DELETE',
  async handle(request: WaitlistRestaurantRequestType) {
    const id = request.getParam('id')

    await waitlists.restaurant.destroy(id)

    return response.json({ message: 'WaitlistRestaurant deleted successfully' })
  },
})
