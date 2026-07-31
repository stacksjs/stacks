import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Coupon, Customer, Order, OrderItem } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  addOrderItemQuantity,
  normalizeCommerceOrderRecord,
  normalizeOrderCouponId,
  normalizeOrderCustomerContext,
  normalizeOrderCustomerOption,
  summarizeCommerceOrders,
} from './commerce-order-records'
import { commerceCurrency, commerceIdentifier, commerceValue } from './commerce-record'

export default new Action({
  name: 'CommerceOrdersAction',
  description: 'Returns persisted Order records with customer context and item counts for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const orders = await Order.orderBy('created_at', 'desc').limit(500).get()
      const orderIds = new Set(orders.map(order =>
        commerceIdentifier(commerceValue(order, 'id', 'uuid'), 'Order'),
      ))
      const numericOrderIds = [...orderIds].map(Number).filter(Number.isSafeInteger)
      const [customers, coupons, items] = await Promise.all([
        Customer.orderBy('name', 'asc').limit(500).get(),
        Coupon.orderBy('id', 'asc').limit(500).get(),
        numericOrderIds.length > 0 ? OrderItem.where('order_id', 'in', numericOrderIds).get() : [],
      ])
      const customerContexts = customers.map(normalizeOrderCustomerContext)
      const customerMap = new Map(customerContexts.map(customer => [customer.id, customer.context]))
      const couponIds = new Set(coupons.map(normalizeOrderCouponId))
      const itemCounts = new Map<string, number>()
      for (const item of items)
        addOrderItemQuantity(item, orderIds, itemCounts)

      const records = orders.map(order =>
        normalizeCommerceOrderRecord(order, customerMap, itemCounts, couponIds),
      )
      const defaultStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']
      const defaultTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY']
      return {
        records,
        summary: summarizeCommerceOrders(records),
        customers: customers
          .map(normalizeOrderCustomerOption)
          .sort((left, right) => left.label.localeCompare(right.label)),
        statuses: [...new Set([...defaultStatuses, ...records.map(record => record.status)])],
        orderTypes: [...new Set([...defaultTypes, ...records.map(record => record.orderType)])],
        defaultCurrency: commerceCurrency((config as any).commerce?.currency, 'Commerce configuration'),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Order records could not be read.',
      }, 503)
    }
  },
})
