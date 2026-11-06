import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { Coupon, Customer, Order, OrderItem } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  addOrderItemQuantity,
  normalizeCommerceOrderRecord,
  normalizeOrderCouponId,
  normalizeOrderCustomerContext,
  normalizeOrderCustomerOption,
  referencedIds,
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
      // Exactly the customers and coupons these orders reference, so no order
      // points at one that was not read (commerce-order-records.ts).
      const customerIds = referencedIds(orders, 'customer_id', 'customerId')
      const couponReferences = referencedIds(orders, 'coupon_id', 'couponId')
      const [referencedCustomers, coupons, items, customers] = await Promise.all([
        customerIds.length > 0 ? Customer.whereIn('id', customerIds).get() : [],
        couponReferences.length > 0 ? Coupon.whereIn('id', couponReferences).get() : [],
        numericOrderIds.length > 0 ? OrderItem.whereIn('order_id', numericOrderIds).get() : [],
        // The order dialog's customer choices.
        Customer.orderBy('name', 'asc').limit(500).get(),
      ])
      const customerContexts = referencedCustomers.map(normalizeOrderCustomerContext)
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
        defaultCurrency: commerceCurrency(config.commerce?.currency, 'Commerce configuration'),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Order records could not be read.', 'CommerceOrdersAction')
    }
  },
})
