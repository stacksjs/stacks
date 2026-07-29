import { Action } from '@stacksjs/actions'
import { Customer, Product, WaitlistProduct } from '@stacksjs/orm'
import { normalizeProductWaitlistCustomerOption, normalizeProductWaitlistOption, normalizeProductWaitlistRecord, summarizeProductWaitlist } from './product-waitlist-records'

export default new Action({
  name: 'ProductWaitlistIndexAction',
  description: 'Returns native product waitlist records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [rows, products, customers] = await Promise.all([
      WaitlistProduct.orderByDesc('id').limit(200).get(),
      Product.orderBy('name').limit(200).get(),
      Customer.orderBy('name').limit(200).get(),
    ])
    const records = rows.map(normalizeProductWaitlistRecord)
    return {
      records,
      summary: summarizeProductWaitlist(records),
      options: {
        products: products.map(normalizeProductWaitlistOption),
        customers: customers.map(normalizeProductWaitlistCustomerOption),
      },
    }
  },
})
