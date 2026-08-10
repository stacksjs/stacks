import { Action } from '@stacksjs/actions'
import { Customer, Product, WaitlistProduct } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeProductWaitlistCustomerOption, normalizeProductWaitlistOption, normalizeProductWaitlistRecord, summarizeProductWaitlist } from './product-waitlist-records'

export default new Action({
  name: 'ProductWaitlistIndexAction',
  description: 'Returns native product waitlist records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [rows, products, customers] = await Promise.all([
        WaitlistProduct.orderByDesc('id').limit(500).get(),
        Product.orderBy('name').limit(500).get(),
        Customer.orderBy('name').limit(500).get(),
      ])
      const productOptions = products.map(normalizeProductWaitlistOption)
      const customerOptions = customers.map(normalizeProductWaitlistCustomerOption)
      const productIds = new Set(productOptions.map(product => product.id))
      const customerIds = new Set(customerOptions.map(customer => customer.id))
      const records = rows.map(row =>
        normalizeProductWaitlistRecord(row, productIds, customerIds),
      )
      return {
        records,
        summary: summarizeProductWaitlist(records),
        options: {
          products: productOptions,
          customers: customerOptions,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product waitlist records could not be read.', 'ProductWaitlistIndexAction')
    }
  },
})
