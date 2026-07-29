import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Category, Order, OrderItem, Payment, Product } from '@stacksjs/orm'
import { normalizeAnalyticsRange } from './request-analytics'
import { buildSalesAnalytics } from './sales-analytics'

export default new Action({
  name: 'SalesAnalyticsAction',
  description: 'Returns currency-safe sales analytics from orders, payments, order items, products, and categories.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const range = normalizeAnalyticsRange(request.get('range'))
    const [orders, payments, orderItems, products, categories] = await Promise.all([
      Order.orderByDesc('id').limit(10_000).get(),
      Payment.orderByDesc('id').limit(10_000).get(),
      OrderItem.orderByDesc('id').limit(20_000).get(),
      Product.orderByDesc('id').limit(10_000).get(),
      Category.orderByDesc('id').limit(10_000).get(),
    ])

    return buildSalesAnalytics(
      orders.map(order => ({
        id: String(order.get('id') || ''),
        status: String(order.get('status') || ''),
        totalAmount: Number(order.get('total_amount') || 0),
        currency: String(order.get('currency') || 'USD'),
        createdAt: String(order.get('created_at') || ''),
      })),
      payments.map(payment => ({
        method: String(payment.get('method') || 'unknown'),
        status: String(payment.get('status') || ''),
        amount: Number(payment.get('amount') || 0),
        refundAmount: Number(payment.get('refund_amount') || 0),
        currency: String(payment.get('currency') || 'USD'),
        createdAt: String(payment.get('created_at') || ''),
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
        categoryId: String(product.get('category_id') || ''),
      })),
      categories.map(category => ({
        id: String(category.get('id') || ''),
        name: String(category.get('name') || ''),
      })),
      range,
    )
  },
})
