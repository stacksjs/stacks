import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Customer, Order, OrderItem } from '@stacksjs/orm'
import {
  normalizeCommerceOrderRecord,
  normalizeOrderCustomerOption,
  summarizeCommerceOrders,
} from './commerce-order-records'

export default new Action({
  name: 'CommerceOrdersAction',
  description: 'Returns persisted Order records with customer context and item counts for dashboard management.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const orders = await Order.orderBy('created_at', 'desc').limit(500).get()
    const orderIds = orders.map(order => Number(order.get('id'))).filter(id => Number.isFinite(id) && id > 0)
    const [customers, items] = await Promise.all([
      Customer.orderBy('name', 'asc').limit(500).get(),
      orderIds.length > 0 ? OrderItem.where('order_id', 'in', orderIds).get() : [],
    ])
    const customerMap = new Map(customers.map(customer => [
      String(customer.get('id') || ''),
      {
        name: String(customer.get('name') || ''),
        email: String(customer.get('email') || ''),
      },
    ]))
    const itemCounts = new Map<string, number>()
    for (const item of items) {
      const orderId = String(item.get('order_id') || '')
      if (orderId)
        itemCounts.set(orderId, (itemCounts.get(orderId) || 0) + 1)
    }

    const records = orders.map(order => normalizeCommerceOrderRecord(order, customerMap, itemCounts))
    const defaultStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELED']
    const defaultTypes = ['DINE_IN', 'TAKEOUT', 'DELIVERY']
    return {
      records,
      summary: summarizeCommerceOrders(records),
      customers: customers
        .map(normalizeOrderCustomerOption)
        .sort((left, right) => left.label.localeCompare(right.label)),
      statuses: [...new Set([...defaultStatuses, ...records.map(record => record.status).filter(Boolean)])],
      orderTypes: [...new Set([...defaultTypes, ...records.map(record => record.orderType).filter(Boolean)])],
      defaultCurrency: String((config as any).commerce?.currency || 'USD').toUpperCase(),
    }
  },
})
