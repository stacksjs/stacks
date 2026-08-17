import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Customer, Order, OrderItem, Product } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  buildCommerceDashboard,
  commerceDashboardQueryStart,
  normalizeCommerceDashboardCustomer,
  normalizeCommerceDashboardOrder,
  normalizeCommerceDashboardOrderItem,
  normalizeCommerceDashboardProduct,
  normalizeCommerceDashboardRange,
} from './commerce-dashboard'

function sqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export default new Action({
  name: 'CommerceDashboard',
  description: 'Returns range-aware commerce metrics, charts, recent orders, and top products from application models.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const range = normalizeCommerceDashboardRange(request.get('range'))
      const now = new Date()
      const queryStart = commerceDashboardQueryStart(range, now)
      const orders = queryStart
        ? await Order.where('created_at', '>=', sqlTimestamp(queryStart)).orderByDesc('id').get()
        : await Order.orderByDesc('id').get()
      const orderRows = orders.map(normalizeCommerceDashboardOrder)
      const orderIds = [...new Set(orderRows.map(order => order.id))]
      const customerIds = [...new Set(orderRows
        .map(order => order.customerId)
        .filter(Boolean))]

      // The normalizers hand back identifiers as strings (a record may key on
      // a uuid), but these columns are numeric, so they go back to numbers at
      // the query boundary - the same conversion CommerceOrdersAction does.
      const numericOrderIds = orderIds.map(Number).filter(Number.isSafeInteger)
      const numericCustomerIds = customerIds.map(Number).filter(Number.isSafeInteger)

      const orderItems = numericOrderIds.length > 0
        ? await OrderItem.whereIn('order_id', numericOrderIds).get()
        : []
      const orderItemRows = orderItems.map(normalizeCommerceDashboardOrderItem)
      const productIds = [...new Set(orderItemRows.map(item => item.productId))]
      const numericProductIds = productIds.map(Number).filter(Number.isSafeInteger)

      const [products, customers] = await Promise.all([
        numericProductIds.length > 0 ? Product.whereIn('id', numericProductIds).get() : [],
        numericCustomerIds.length > 0 ? Customer.whereIn('id', numericCustomerIds).get() : [],
      ])

      return buildCommerceDashboard(
        orderRows,
        orderItemRows,
        products.map(normalizeCommerceDashboardProduct),
        customers.map(normalizeCommerceDashboardCustomer),
        range,
        now,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Commerce overview records could not be read.', 'CommerceDashboardAction')
    }
  },
})
