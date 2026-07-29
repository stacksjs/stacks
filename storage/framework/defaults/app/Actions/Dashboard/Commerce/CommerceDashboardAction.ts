import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Customer, Order, OrderItem, Product } from '@stacksjs/orm'
import {
  buildCommerceDashboard,
  commerceDashboardQueryStart,
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
    const range = normalizeCommerceDashboardRange(request.get('range'))
    const now = new Date()
    const queryStart = commerceDashboardQueryStart(range, now)
    const orders = queryStart
      ? await Order.where('created_at', '>=', sqlTimestamp(queryStart)).orderByDesc('id').get()
      : await Order.orderByDesc('id').get()

    const orderIds = orders
      .map(order => Number(order.get('id')))
      .filter(Number.isFinite)
    const customerIds = orders
      .map(order => Number(order.get('customer_id')))
      .filter(id => Number.isFinite(id) && id > 0)
    const orderItems = orderIds.length > 0
      ? await OrderItem.where('order_id', 'in', orderIds).get()
      : []
    const productIds = orderItems
      .map(item => Number(item.get('product_id')))
      .filter(id => Number.isFinite(id) && id > 0)

    const [products, customers] = await Promise.all([
      productIds.length > 0 ? Product.where('id', 'in', productIds).get() : [],
      customerIds.length > 0 ? Customer.where('id', 'in', customerIds).get() : [],
    ])

    return buildCommerceDashboard(
      orders.map(order => ({
        id: String(order.get('id') || ''),
        status: String(order.get('status') || ''),
        totalAmount: Number(order.get('total_amount') || 0),
        currency: String(order.get('currency') || 'USD'),
        customerId: String(order.get('customer_id') || ''),
        createdAt: String(order.get('created_at') || ''),
      })),
      orderItems.map(item => ({
        orderId: String(item.get('order_id') || ''),
        productId: String(item.get('product_id') || ''),
        quantity: Number(item.get('quantity') || 0),
        price: Number(item.get('price') || 0),
      })),
      products.map(product => ({
        id: String(product.get('id') || ''),
        name: String(product.get('name') || ''),
      })),
      customers.map(customer => ({
        id: String(customer.get('id') || ''),
        name: String(customer.get('name') || ''),
      })),
      range,
      now,
    )
  },
})
