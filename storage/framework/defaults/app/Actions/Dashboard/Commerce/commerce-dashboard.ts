import {
  commerceCurrency,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export type CommerceDashboardRange = 'today' | '7d' | '30d' | '90d' | 'year' | 'all'

export interface CommerceDashboardOrderRow {
  id: string
  status: string
  totalAmount: number
  currency: string
  customerId: string
  createdAt: string
}

export interface CommerceDashboardOrderItemRow {
  orderId: string
  productId: string
  quantity: number
  price: number
}

export interface CommerceDashboardProductRow {
  id: string
  name: string
}

export interface CommerceDashboardCustomerRow {
  id: string
  name: string
}

export interface CommerceDashboardStat {
  label: string
  value: string
  change: string
  detail: string
}

export interface CommerceDashboardChartSeries {
  labels: string[]
  revenue: Array<{ currency: string, data: number[] }>
  orders: number[]
}

export interface CommerceDashboardProduct {
  id: string
  name: string
  sales: number
  revenue: string
}

export interface CommerceDashboardOrder {
  id: string
  customer: string
  total: string
  status: string
  createdAt: string
}

export interface CommerceDashboardResult {
  range: CommerceDashboardRange
  rangeLabel: string
  stats: CommerceDashboardStat[]
  charts: CommerceDashboardChartSeries
  topProducts: CommerceDashboardProduct[]
  recentOrders: CommerceDashboardOrder[]
}

interface RangeWindow {
  start: Date | null
  previousStart: Date | null
  bucket: 'hour' | 'day' | 'month' | 'year'
  label: string
}

interface Bucket {
  key: string
  label: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeCommerceDashboardOrder(record: any): CommerceDashboardOrderRow {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Order')
  const source = `Order ${id}`
  return {
    id,
    status: commerceRequiredString(commerceValue(record, 'status'), source, 'status'),
    totalAmount: commerceNumber(
      commerceValue(record, 'total_amount', 'totalAmount'),
      source,
      'total_amount',
      { min: 0 },
    ),
    currency: commerceCurrency(commerceValue(record, 'currency'), source),
    customerId: commerceOptionalIdentifier(
      commerceValue(record, 'customer_id', 'customerId'),
      source,
      'customer_id',
    ),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function normalizeCommerceDashboardOrderItem(record: any): CommerceDashboardOrderItemRow {
  const id = commerceIdentifier(commerceValue(record, 'id'), 'OrderItem')
  const source = `OrderItem ${id}`
  return {
    orderId: commerceIdentifier(
      commerceValue(record, 'order_id', 'orderId'),
      source,
      'order_id',
    ),
    productId: commerceIdentifier(
      commerceValue(record, 'product_id', 'productId'),
      source,
      'product_id',
    ),
    quantity: commerceNumber(commerceValue(record, 'quantity'), source, 'quantity', {
      min: 1,
      integer: true,
    }),
    price: commerceNumber(commerceValue(record, 'price'), source, 'price', { min: 0 }),
  }
}

export function normalizeCommerceDashboardProduct(record: any): CommerceDashboardProductRow {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Product')
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), `Product ${id}`, 'name'),
  }
}

export function normalizeCommerceDashboardCustomer(record: any): CommerceDashboardCustomerRow {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), `Customer ${id}`, 'name'),
  }
}

export function normalizeCommerceDashboardRange(value: unknown): CommerceDashboardRange {
  const range = String(value || '').toLowerCase()
  return ['today', '7d', '30d', '90d', 'year', 'all'].includes(range)
    ? range as CommerceDashboardRange
    : '30d'
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function rangeWindow(range: CommerceDashboardRange, now: Date, rows: CommerceDashboardOrderRow[]): RangeWindow {
  if (range === 'today') {
    const start = startOfUtcDay(now)
    return { start, previousStart: new Date(start.getTime() - DAY_MS), bucket: 'hour', label: 'Today' }
  }

  const dayRanges: Partial<Record<CommerceDashboardRange, number>> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  }
  const days = dayRanges[range]
  if (days) {
    const start = new Date(startOfUtcDay(now).getTime() - (days - 1) * DAY_MS)
    return {
      start,
      previousStart: new Date(start.getTime() - days * DAY_MS),
      bucket: 'day',
      label: `Last ${days} days`,
    }
  }

  if (range === 'year') {
    const start = startOfUtcMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)))
    return {
      start,
      previousStart: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 12, 1)),
      bucket: 'month',
      label: 'Last year',
    }
  }

  const earliest = rows
    .map(row => timestamp(row.createdAt))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0]
  const start = Number.isFinite(earliest) ? new Date(earliest) : startOfUtcMonth(now)
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / DAY_MS)
  return {
    start,
    previousStart: null,
    bucket: elapsedDays > 730 ? 'year' : elapsedDays > 90 ? 'month' : 'day',
    label: 'All time',
  }
}

export function commerceDashboardQueryStart(range: CommerceDashboardRange, now = new Date()): Date | null {
  const window = rangeWindow(range, now, [])
  return window.previousStart
}

function timestamp(value: string): number {
  return new Date(commerceTimestamp(value, 'Commerce dashboard order', 'created_at')).getTime()
}

function currency(value: string): string {
  return commerceCurrency(value, 'Commerce dashboard order')
}

function isCancelled(status: string): boolean {
  return ['canceled', 'cancelled'].includes(status.toLowerCase())
}

function isFulfilled(status: string): boolean {
  return ['completed', 'delivered', 'shipped'].includes(status.toLowerCase())
}

function percentChange(current: number, previous: number): string {
  if (previous <= 0)
    return ''
  const percentage = ((current - previous) / previous) * 100
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage.toFixed(1)}%`
}

function formatMoney(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

function formatCurrencyTotals(totals: Map<string, number>): { value: string, detail: string } {
  const entries = [...totals.entries()].sort((left, right) => right[1] - left[1])
  if (entries.length === 0)
    return { value: formatMoney(0, 'USD'), detail: 'No recorded revenue' }
  if (entries.length === 1)
    return { value: formatMoney(entries[0][1], entries[0][0]), detail: entries[0][0] }
  return {
    value: `${entries.length} currencies`,
    detail: entries.map(([code, amount]) => formatMoney(amount, code)).join(' | '),
  }
}

function formatCurrencyAverages(totals: Map<string, { amount: number, orders: number }>): { value: string, detail: string } {
  const entries = [...totals.entries()]
    .filter(([, total]) => total.orders > 0)
    .sort((left, right) => right[1].amount - left[1].amount)
  if (entries.length === 0)
    return { value: formatMoney(0, 'USD'), detail: 'No recorded orders' }
  if (entries.length === 1)
    return {
      value: formatMoney(entries[0][1].amount / entries[0][1].orders, entries[0][0]),
      detail: entries[0][0],
    }
  return {
    value: 'Mixed currencies',
    detail: entries
      .map(([code, total]) => formatMoney(total.amount / total.orders, code))
      .join(' | '),
  }
}

function bucketKey(date: Date, bucket: RangeWindow['bucket']): string {
  if (bucket === 'hour')
    return date.toISOString().slice(0, 13)
  if (bucket === 'day')
    return date.toISOString().slice(0, 10)
  if (bucket === 'month')
    return date.toISOString().slice(0, 7)
  return date.toISOString().slice(0, 4)
}

function bucketLabel(date: Date, bucket: RangeWindow['bucket']): string {
  if (bucket === 'hour')
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'UTC' }).format(date)
  if (bucket === 'day')
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
  if (bucket === 'month')
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
  return String(date.getUTCFullYear())
}

function buildBuckets(start: Date, end: Date, bucket: RangeWindow['bucket']): Bucket[] {
  const buckets: Bucket[] = []
  const cursor = bucket === 'hour'
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours()))
    : bucket === 'day'
      ? startOfUtcDay(start)
      : bucket === 'month'
        ? startOfUtcMonth(start)
        : new Date(Date.UTC(start.getUTCFullYear(), 0, 1))

  while (cursor.getTime() <= end.getTime()) {
    buckets.push({ key: bucketKey(cursor, bucket), label: bucketLabel(cursor, bucket) })
    if (bucket === 'hour')
      cursor.setUTCHours(cursor.getUTCHours() + 1)
    else if (bucket === 'day')
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    else if (bucket === 'month')
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    else
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1)
  }
  return buckets
}

function singleCurrencyChange(current: Map<string, number>, previous: Map<string, number>): string {
  if (current.size !== 1)
    return ''
  const [[code, amount]] = [...current.entries()]
  return percentChange(amount, previous.get(code) || 0)
}

export function buildCommerceDashboard(
  allOrders: CommerceDashboardOrderRow[],
  orderItems: CommerceDashboardOrderItemRow[],
  products: CommerceDashboardProductRow[],
  customers: CommerceDashboardCustomerRow[],
  range: CommerceDashboardRange,
  now = new Date(),
): CommerceDashboardResult {
  const allOrderIds = new Set(allOrders.map(order => order.id))
  const allProductIds = new Set(products.map(product => product.id))
  const allCustomerIds = new Set(customers.map(customer => customer.id))
  for (const order of allOrders) {
    if (order.customerId && !allCustomerIds.has(order.customerId))
      throw new TypeError(`Order ${order.id}.customer_id references missing Customer ${order.customerId}.`)
  }
  for (const item of orderItems) {
    if (!allOrderIds.has(item.orderId))
      throw new TypeError(`OrderItem.order_id references missing Order ${item.orderId}.`)
    if (!allProductIds.has(item.productId))
      throw new TypeError(`OrderItem.product_id references missing Product ${item.productId}.`)
  }

  const window = rangeWindow(range, now, allOrders)
  const startTime = window.start?.getTime() ?? Number.NEGATIVE_INFINITY
  const previousStartTime = window.previousStart?.getTime() ?? Number.NEGATIVE_INFINITY
  const nowTime = now.getTime()
  const current = allOrders.filter((order) => {
    const createdAt = timestamp(order.createdAt)
    return createdAt >= startTime && createdAt <= nowTime
  })
  const previous = window.previousStart
    ? allOrders.filter((order) => {
        const createdAt = timestamp(order.createdAt)
        return createdAt >= previousStartTime && createdAt < startTime
      })
    : []

  const currentRevenue = new Map<string, number>()
  const previousRevenue = new Map<string, number>()
  const currentAverages = new Map<string, { amount: number, orders: number }>()
  for (const order of current) {
    if (isCancelled(order.status))
      continue
    const code = currency(order.currency)
    currentRevenue.set(code, (currentRevenue.get(code) || 0) + order.totalAmount)
    const average = currentAverages.get(code) || { amount: 0, orders: 0 }
    average.amount += order.totalAmount
    average.orders++
    currentAverages.set(code, average)
  }
  for (const order of previous) {
    if (isCancelled(order.status))
      continue
    const code = currency(order.currency)
    previousRevenue.set(code, (previousRevenue.get(code) || 0) + order.totalAmount)
  }

  const revenueSummary = formatCurrencyTotals(currentRevenue)
  const averageSummary = formatCurrencyAverages(currentAverages)
  const eligibleCurrent = current.filter(order => !isCancelled(order.status))
  const eligiblePrevious = previous.filter(order => !isCancelled(order.status))
  const fulfilledCurrent = eligibleCurrent.filter(order => isFulfilled(order.status)).length
  const fulfilledPrevious = eligiblePrevious.filter(order => isFulfilled(order.status)).length
  const fulfillmentRate = eligibleCurrent.length > 0 ? fulfilledCurrent / eligibleCurrent.length * 100 : 0
  const previousFulfillmentRate = eligiblePrevious.length > 0 ? fulfilledPrevious / eligiblePrevious.length * 100 : 0

  const start = window.start || startOfUtcMonth(now)
  const buckets = buildBuckets(start, now, window.bucket)
  const bucketIndexes = new Map(buckets.map((bucket, index) => [bucket.key, index]))
  const orderSeries = Array.from({ length: buckets.length }, () => 0)
  const revenueSeries = new Map<string, number[]>()
  for (const order of current) {
    const createdAt = new Date(timestamp(order.createdAt))
    const index = bucketIndexes.get(bucketKey(createdAt, window.bucket))
    if (index === undefined)
      continue
    orderSeries[index]++
    if (isCancelled(order.status))
      continue
    const code = currency(order.currency)
    const values = revenueSeries.get(code) || Array.from({ length: buckets.length }, () => 0)
    values[index] += order.totalAmount
    revenueSeries.set(code, values)
  }

  const ordersById = new Map(current.map(order => [order.id, order]))
  const productsById = new Map(products.map(product => [product.id, product]))
  const productTotals = new Map<string, { productId: string, name: string, currency: string, sales: number, revenue: number }>()
  for (const item of orderItems) {
    const order = ordersById.get(item.orderId)
    if (!order || isCancelled(order.status))
      continue
    const product = productsById.get(item.productId)
    if (!product)
      throw new TypeError(`OrderItem product_id references missing Product ${item.productId}.`)
    const code = currency(order.currency)
    const key = `${item.productId}:${code}`
    const total = productTotals.get(key) || {
      productId: item.productId,
      name: product.name,
      currency: code,
      sales: 0,
      revenue: 0,
    }
    total.sales += item.quantity
    total.revenue += item.quantity * item.price
    productTotals.set(key, total)
  }

  const customersById = new Map(customers.map(customer => [customer.id, customer.name]))
  const recentOrders = [...current]
    .sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt))
    .slice(0, 5)
    .map((order) => {
      const customer = order.customerId ? customersById.get(order.customerId) : undefined
      if (order.customerId && !customer)
        throw new TypeError(`Order ${order.id}.customer_id references missing Customer ${order.customerId}.`)
      return {
        id: `ORD-${order.id.padStart(4, '0')}`,
        customer: customer || 'Guest',
        total: formatMoney(order.totalAmount, currency(order.currency)),
        status: order.status,
        createdAt: order.createdAt,
      }
    })

  return {
    range,
    rangeLabel: window.label,
    stats: [
      {
        label: 'Net revenue',
        value: revenueSummary.value,
        change: window.previousStart ? singleCurrencyChange(currentRevenue, previousRevenue) : '',
        detail: revenueSummary.detail,
      },
      {
        label: 'Orders',
        value: String(current.length),
        change: window.previousStart ? percentChange(current.length, previous.length) : '',
        detail: `${eligibleCurrent.length} non-cancelled`,
      },
      {
        label: 'Average order value',
        value: averageSummary.value,
        change: '',
        detail: averageSummary.detail,
      },
      {
        label: 'Fulfillment rate',
        value: `${fulfillmentRate.toFixed(1)}%`,
        change: window.previousStart && eligiblePrevious.length > 0
          ? percentChange(fulfillmentRate, previousFulfillmentRate)
          : '',
        detail: `${fulfilledCurrent} of ${eligibleCurrent.length} eligible orders`,
      },
    ],
    charts: {
      labels: buckets.map(bucket => bucket.label),
      revenue: [...revenueSeries.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, data]) => ({ currency: code, data })),
      orders: orderSeries,
    },
    topProducts: [...productTotals.entries()]
      .map(([id, total]) => ({
        id,
        name: total.name,
        sales: total.sales,
        revenue: formatMoney(total.revenue, total.currency),
      }))
      .sort((left, right) => right.sales - left.sales || left.name.localeCompare(right.name))
      .slice(0, 5),
    recentOrders,
  }
}
