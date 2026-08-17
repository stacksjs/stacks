import { Action } from '@stacksjs/actions'
import { Customer, LicenseKey, Order, Product } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  indexLicenseKeyOptions,
  normalizeLicenseKeyCustomer,
  normalizeLicenseKeyOrder,
  normalizeLicenseKeyProduct,
  normalizeLicenseKeyRecord,
} from './license-key-records'

export default new Action({
  name: 'Dashboard License Keys',
  description: 'Returns license keys with lightweight customer, product, and order summaries.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const keys = await LicenseKey.orderByDesc('id').limit(500).get()
      const customerIds = [...new Set(keys.map(key => key.get('customer_id')).filter(Boolean))]
      const productIds = [...new Set(keys.map(key => key.get('product_id')).filter(Boolean))]
      const orderIds = [...new Set(keys.map(key => key.get('order_id')).filter(Boolean))]
      const [customers, products, orders] = await Promise.all([
        customerIds.length ? Customer.whereIn('id', customerIds).get() : [],
        productIds.length ? Product.whereIn('id', productIds).get() : [],
        orderIds.length ? Order.whereIn('id', orderIds).get() : [],
      ])
      const customerMap = indexLicenseKeyOptions(customers.map(normalizeLicenseKeyCustomer))
      const productMap = indexLicenseKeyOptions(products.map(normalizeLicenseKeyProduct))
      const orderMap = indexLicenseKeyOptions(orders.map(normalizeLicenseKeyOrder))
      return keys.map(key => normalizeLicenseKeyRecord(key, customerMap, productMap, orderMap))
    }
    catch (error) {
      return dashboardOperationalError(error, 'License key records could not be read.', 'LicenseKeyIndexAction')
    }
  },
})
