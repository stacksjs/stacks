import { Action } from '@stacksjs/actions'
import { Customer, WaitlistRestaurant } from '@stacksjs/orm'
import { normalizeRestaurantWaitlistCustomerOption, normalizeRestaurantWaitlistRecord, summarizeRestaurantWaitlist } from './restaurant-waitlist-records'

export default new Action({
  name: 'RestaurantWaitlistIndexAction',
  description: 'Return native restaurant waitlist records and customer options for the dashboard',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [rows, customers] = await Promise.all([
      WaitlistRestaurant.orderByDesc('id').limit(200).get(),
      Customer.orderBy('name').limit(200).get(),
    ])
    const records = rows.map(normalizeRestaurantWaitlistRecord)

    return {
      records,
      summary: summarizeRestaurantWaitlist(records),
      options: {
        customers: customers.map(normalizeRestaurantWaitlistCustomerOption),
      },
    }
  },
})
