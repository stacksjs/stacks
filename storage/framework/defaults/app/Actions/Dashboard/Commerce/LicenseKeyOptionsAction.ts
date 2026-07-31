import { Action } from '@stacksjs/actions'
import { Customer, Order, Product } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  normalizeLicenseKeyCustomer,
  normalizeLicenseKeyOrder,
  normalizeLicenseKeyProduct,
} from './license-key-records'

export default new Action({
  name: 'License Key Options',
  description: 'Returns lightweight relationship options for license key forms.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const [customers, products, orders] = await Promise.all([
        Customer.orderBy('name', 'asc').limit(500).get(),
        Product.orderBy('name', 'asc').limit(500).get(),
        Order.orderByDesc('id').limit(500).get(),
      ])
      return {
        customers: customers.map(normalizeLicenseKeyCustomer),
        products: products.map(normalizeLicenseKeyProduct),
        orders: orders.map(normalizeLicenseKeyOrder),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'License key options could not be read.',
      }, 503)
    }
  },
})
