import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Customer } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  normalizeCommerceCustomerCurrency,
  normalizeCommerceCustomerRecord,
  summarizeCommerceCustomers,
} from './commerce-customer-records'

export default new Action({
  name: 'CommerceCustomersAction',
  description: 'Returns persisted Customer records and summary values for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const customers = await Customer.orderBy('name', 'asc').limit(500).get()
      const records = customers.map(normalizeCommerceCustomerRecord)
      return {
        records,
        summary: summarizeCommerceCustomers(records),
        currency: normalizeCommerceCustomerCurrency((config as any).commerce?.currency),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customer records could not be read.', 'CommerceCustomersAction')
    }
  },
})
