import { Action } from '@stacksjs/actions/runtime'
import { Customer, Order, Payment } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { commerceIdentifier, commerceValue, referencedIds } from './commerce-record'
import { normalizePaymentRecord, summarizePayments } from './payment-records'

export default new Action({
  name: 'CommercePaymentsAction',
  description: 'Returns persisted commerce payments and currency-safe summaries.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const paymentRows = await Payment.orderByDesc('id').limit(500).get()
      // Exactly the orders and customers these payments reference. This read
      // the 500 OLDEST orders and the first 500 customers, and a payment
      // naming one outside them is refused (normalizePaymentRecord), so once a
      // store passed its 500th order every newer payment failed the whole
      // Payments page (stacksjs/stacks#3218).
      const orderReferences = referencedIds(paymentRows, 'order_id', 'orderId')
      const customerReferences = referencedIds(paymentRows, 'customer_id', 'customerId')
      const [orders, customers] = await Promise.all([
        orderReferences.length > 0 ? Order.whereIn('id', orderReferences).get() : [],
        customerReferences.length > 0 ? Customer.whereIn('id', customerReferences).get() : [],
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
      return dashboardOperationalError(error, 'Payment records could not be read.', 'CommercePaymentsAction')
    }
  },
})
