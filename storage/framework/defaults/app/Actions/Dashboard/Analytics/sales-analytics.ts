import type { AnalyticsRange } from './request-analytics'

export interface SalesOrderRow {
  id: string
  status: string
  totalAmount: number
  currency: string
  createdAt: string
}

export interface SalesPaymentRow {
  method: string
  status: string
  amount: number
  refundAmount: number
  currency: string
  createdAt: string
}

export interface SalesOrderItemRow {
  orderId: string
  productId: string
  quantity: number
  price: number
}

export interface SalesProductRow {
  id: string
  name: string
  categoryId: string
}

export interface SalesCategoryRow {
  id: string
  name: string
}

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

function timestamp(value: string): number {
  if (!value)
    return Number.NaN
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  return new Date(normalized).getTime()
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase() || 'USD'
}

function isCancelled(status: string): boolean {
  return ['canceled', 'cancelled'].includes(status.toLowerCase())
}

function paymentRefund(payment: SalesPaymentRow): number {
  const status = payment.status.toLowerCase()
  if (status === 'refunded')
    return payment.refundAmount > 0 ? payment.refundAmount : payment.amount
  if (status === 'partiallyrefunded' || status === 'partially_refunded')
    return payment.refundAmount
  return 0
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export function buildSalesAnalytics(
  allOrders: SalesOrderRow[],
  allPayments: SalesPaymentRow[],
  orderItems: SalesOrderItemRow[],
  products: SalesProductRow[],
  categories: SalesCategoryRow[],
  range: AnalyticsRange,
  now = new Date(),
) {
  const start = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)
  const inRange = (createdAt: string) => timestamp(createdAt) >= start.getTime() && timestamp(createdAt) <= now.getTime()
  const orders = allOrders.filter(order => inRange(order.createdAt))
  const payments = allPayments.filter(payment => inRange(payment.createdAt))

  const currencyMap = new Map<string, { gross: number, cancelled: number, orders: number }>()
  for (const order of orders) {
    const currency = normalizeCurrency(order.currency)
    const total = currencyMap.get(currency) || { gross: 0, cancelled: 0, orders: 0 }
    total.gross += order.totalAmount
    total.orders++
    if (isCancelled(order.status))
      total.cancelled += order.totalAmount
    currencyMap.set(currency, total)
  }

  const currencyTotals = [...currencyMap.entries()]
    .map(([currency, total]) => ({
      currency,
      orders: total.orders,
      gross: total.gross,
      cancelled: total.cancelled,
      net: total.gross - total.cancelled,
      average: total.orders > 0 ? Math.round((total.gross / total.orders) * 100) / 100 : 0,
    }))
    .sort((left, right) => right.net - left.net)

  const paymentMap = new Map<string, { method: string, currency: string, amount: number, refunds: number, transactions: number }>()
  for (const payment of payments) {
    const currency = normalizeCurrency(payment.currency)
    const key = `${payment.method}:${currency}`
    const total = paymentMap.get(key) || {
      method: titleCase(payment.method || 'unknown'),
      currency,
      amount: 0,
      refunds: 0,
      transactions: 0,
    }
    total.amount += payment.amount
    total.refunds += paymentRefund(payment)
    total.transactions++
    paymentMap.set(key, total)
  }
  const totalPaymentTransactions = payments.length
  const paymentMethods = [...paymentMap.values()]
    .map(method => ({
      ...method,
      net: method.amount - method.refunds,
      percentage: percentage(method.transactions, totalPaymentTransactions),
    }))
    .sort((left, right) =>
      right.transactions - left.transactions
      || left.method.localeCompare(right.method)
      || left.currency.localeCompare(right.currency),
    )

  const dailyMap = new Map<string, { date: string, currency: string, value: number, orders: number }>()
  for (const order of orders) {
    const date = new Date(timestamp(order.createdAt)).toISOString().slice(0, 10)
    const currency = normalizeCurrency(order.currency)
    const key = `${date}:${currency}`
    const total = dailyMap.get(key) || { date, currency, value: 0, orders: 0 }
    total.value += order.totalAmount
    total.orders++
    dailyMap.set(key, total)
  }
  const dailyOrders = [...dailyMap.values()]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 30)

  const productMap = new Map(products.map(product => [product.id, product]))
  const categoryMap = new Map(categories.map(category => [category.id, category]))
  const ordersById = new Map(orders.map(order => [order.id, order]))
  const productTotals = new Map<string, { productId: string, name: string, quantity: number, revenue: number, categoryId: string, currency: string }>()
  for (const item of orderItems) {
    const order = ordersById.get(item.orderId)
    if (!order)
      continue
    const product = productMap.get(item.productId)
    const currency = normalizeCurrency(order.currency)
    const key = `${item.productId}:${currency}`
    const current = productTotals.get(key) || {
      productId: item.productId,
      name: product?.name || `Product ${item.productId}`,
      quantity: 0,
      revenue: 0,
      categoryId: product?.categoryId || '',
      currency,
    }
    current.quantity += item.quantity
    current.revenue += item.quantity * item.price
    productTotals.set(key, current)
  }
  const topProducts = [...productTotals.entries()]
    .map(([id, product]) => ({ id, ...product }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 10)

  const categoryTotals = new Map<string, { categoryId: string, name: string, quantity: number, revenue: number, currency: string }>()
  for (const product of topProducts) {
    const categoryId = product.categoryId || 'uncategorized'
    const id = `${categoryId}:${product.currency}`
    const current = categoryTotals.get(id) || {
      categoryId,
      name: categoryMap.get(categoryId)?.name || 'Uncategorized',
      quantity: 0,
      revenue: 0,
      currency: product.currency,
    }
    current.quantity += product.quantity
    current.revenue += product.revenue
    categoryTotals.set(id, current)
  }

  return {
    source: 'models' as const,
    range,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    overview: {
      orders: orders.length,
      payments: payments.length,
      refunds: payments.filter(payment => paymentRefund(payment) > 0).length,
      currencies: new Set([...orders.map(order => normalizeCurrency(order.currency)), ...payments.map(payment => normalizeCurrency(payment.currency))]).size,
    },
    currencyTotals,
    paymentMethods,
    dailyOrders,
    topProducts,
    categories: [...categoryTotals.entries()]
      .map(([id, category]) => ({ id, ...category }))
      .sort((left, right) => right.revenue - left.revenue),
  }
}
