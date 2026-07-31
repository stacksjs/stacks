import { Action } from '@stacksjs/actions'
import { Customer, Order, Payment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceValue } from './commerce-record'
import { normalizePaymentRecord, summarizePayments } from './payment-records'

export default new Action({
  name: 'CommercePaymentsAction',
  description: 'Returns persisted commerce payments and currency-safe summaries.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [paymentRows, orders, customers] = await Promise.all([
        Payment.orderByDesc('id').limit(500).get(),
        Order.orderBy('id', 'asc').limit(500).get(),
        Customer.orderBy('id', 'asc').limit(500).get(),
      ])
      const orderIds = new Set(orders.map(order =>
        commerceIdentifier(commerceValue(order, 'id', 'uuid'), 'Order'),
      ))
      const customerIds = new Set(customers.map(customer =>
        commerceIdentifier(commerceValue(customer, 'id', 'uuid'), 'Customer'),
      ))
      const records = paymentRows.map(payment =>
        normalizePaymentRecord(payment, { orderIds, customerIds }),
      )
      return {
        records,
        summary: summarizePayments(records),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Payment records could not be read.',
      }, 503)
    }
  },
})
