import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Customer, Order, OrderItem, Product } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
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
      const orderItems = orderIds.length > 0
        ? await OrderItem.where('order_id', 'in', orderIds).get()
        : []
      const orderItemRows = orderItems.map(normalizeCommerceDashboardOrderItem)
      const productIds = [...new Set(orderItemRows.map(item => item.productId))]

      const [products, customers] = await Promise.all([
        productIds.length > 0 ? Product.where('id', 'in', productIds).get() : [],
        customerIds.length > 0 ? Customer.where('id', 'in', customerIds).get() : [],
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
      return response.json({
        message: error instanceof Error ? error.message : 'Commerce overview records could not be read.',
      }, 503)
    }
  },
})
