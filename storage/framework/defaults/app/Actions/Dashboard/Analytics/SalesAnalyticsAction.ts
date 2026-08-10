import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Category, Order, OrderItem, Payment, Product } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  analyticsCurrency,
  analyticsIdentifier,
  analyticsNumber,
  analyticsOptionalNumber,
  analyticsOptionalString,
  analyticsString,
  analyticsTimestamp,
} from './analytics-record'
import { normalizeAnalyticsRange } from './request-analytics'
import { buildSalesAnalytics } from './sales-analytics'

export default new Action({
  name: 'SalesAnalyticsAction',
  description: 'Returns currency-safe sales analytics from orders, payments, order items, products, and categories.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let range
    try {
      range = normalizeAnalyticsRange(request.get('range'))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'The analytics query is invalid.',
      }, 422)
    }
    try {
      const [orders, payments, orderItems, products, categories] = await Promise.all([
        Order.orderByDesc('id').limit(10_000).get(),
        Payment.orderByDesc('id').limit(10_000).get(),
        OrderItem.orderByDesc('id').limit(20_000).get(),
        Product.orderByDesc('id').limit(10_000).get(),
        Category.orderByDesc('id').limit(10_000).get(),
      ])

      return buildSalesAnalytics(
        orders.map((order) => {
          const id = analyticsIdentifier(order.get('id'), 'Order')
          const source = `Order ${id}`
          return {
            id,
            status: analyticsString(order.get('status'), source, 'status'),
            totalAmount: analyticsNumber(order.get('total_amount'), source, 'total_amount', { min: 0 }),
            currency: analyticsCurrency(order.get('currency'), source),
            createdAt: analyticsTimestamp(order.get('created_at'), source),
          }
        }),
        payments.map((payment) => {
          const id = analyticsIdentifier(payment.get('id'), 'Payment')
          const source = `Payment ${id}`
          return {
            method: analyticsString(payment.get('method'), source, 'method'),
            status: analyticsString(payment.get('status'), source, 'status'),
            amount: analyticsNumber(payment.get('amount'), source, 'amount', { min: 0 }),
            refundAmount: analyticsOptionalNumber(payment.get('refund_amount'), source, 'refund_amount', { min: 0 }) ?? 0,
            currency: analyticsCurrency(payment.get('currency'), source),
            createdAt: analyticsTimestamp(payment.get('created_at'), source),
          }
        }),
        orderItems.map((item) => {
          const id = analyticsIdentifier(item.get('id'), 'OrderItem')
          const source = `OrderItem ${id}`
          return {
            orderId: analyticsIdentifier(item.get('order_id'), source, 'order_id'),
            productId: analyticsIdentifier(item.get('product_id'), source, 'product_id'),
            quantity: analyticsNumber(item.get('quantity'), source, 'quantity', { min: 1, integer: true }),
            price: analyticsNumber(item.get('price'), source, 'price', { min: 0 }),
          }
        }),
        products.map((product) => {
          const id = analyticsIdentifier(product.get('id'), 'Product')
          const source = `Product ${id}`
          return {
            id,
            name: analyticsString(product.get('name'), source, 'name'),
            categoryId: analyticsOptionalString(product.get('category_id'), source, 'category_id'),
          }
        }),
        categories.map((category) => {
          const id = analyticsIdentifier(category.get('id'), 'Category')
          return {
            id,
            name: analyticsString(category.get('name'), `Category ${id}`, 'name'),
          }
        }),
        range,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Sales analytics records could not be read.', 'SalesAnalyticsAction')
    }
  },
})
