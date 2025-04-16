import type { WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Store',
  description: 'WaitlistRestaurant Store ORM Action',
  method: 'POST',
  async handle(request: WaitlistRestaurantRequestType) {
    await request.validate()

    const data = {
      restaurant_id: request.get<number>('restaurant_id'),
      customer_id: request.get<number>('customer_id'),
      name: request.get('name'),
      email: request.get('email'),
      quantity: request.get<number>('quantity'),
      notification_preference: request.get('notification_preference'),
      source: request.get('source'),
      status: request.get('status'),
      party_size: request.get<number>('party_size'),
      check_in_time: request.get<number>('check_in_time'),
      table_preference: request.get('table_preference'),
      quoted_wait_time: request.get<number>('quoted_wait_time'),
    }

    const model = await waitlists.restaurant.store(data)

    return response.json(model)
  },
})
