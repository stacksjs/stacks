import { Action } from '@stacksjs/actions'
import { Customer, WaitlistRestaurant } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { normalizeRestaurantWaitlistCustomerOption, normalizeRestaurantWaitlistRecord, summarizeRestaurantWaitlist } from './restaurant-waitlist-records'

export default new Action({
  name: 'RestaurantWaitlistIndexAction',
  description: 'Return native restaurant waitlist records and customer options for the dashboard',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [rows, customers] = await Promise.all([
        WaitlistRestaurant.orderByDesc('id').limit(500).get(),
        Customer.orderBy('name').limit(500).get(),
      ])
      const customerOptions = customers.map(normalizeRestaurantWaitlistCustomerOption)
      const customerIds = new Set(customerOptions.map(customer => customer.id))
      const records = rows.map(row => normalizeRestaurantWaitlistRecord(row, customerIds))

      return {
        records,
        summary: summarizeRestaurantWaitlist(records),
        options: {
          customers: customerOptions,
        },
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Restaurant waitlist records could not be read.',
      }, 503)
    }
  },
})
