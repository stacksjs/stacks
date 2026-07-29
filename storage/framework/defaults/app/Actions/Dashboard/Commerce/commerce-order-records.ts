export interface CommerceOrderRecord {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  status: string
  totalAmount: number
  currency: string
  taxAmount: number
  discountAmount: number
  deliveryFee: number
  tipAmount: number
  orderType: string
  deliveryAddress: string
  specialInstructions: string
  estimatedDeliveryTime: string
  appliedCouponId: string
  couponId: string
  itemCount: number
  createdAt: string
}

export interface CommerceOrderSummary {
  total: number
  pending: number
  inProgress: number
  completed: number
  cancelled: number
  currencyTotals: Array<{ currency: string, amount: number }>
}

export interface OrderCustomerOption {
  id: string
  label: string
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function nonNegativeNumber(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) && result >= 0 ? result : 0
}

export function normalizeCommerceOrderRecord(
  order: any,
  customers: Map<string, { name: string, email: string }>,
  itemCounts: Map<string, number>,
): CommerceOrderRecord {
  const id = text(value(order, 'id', 'uuid'))
  const customerId = text(value(order, 'customer_id', 'customerId'))
  const customer = customers.get(customerId)
  return {
    id,
    customerId,
    customerName: customer?.name || (customerId ? `Customer ${customerId}` : 'Unassigned customer'),
    customerEmail: customer?.email || '',
    status: text(value(order, 'status')) || 'UNKNOWN',
    totalAmount: nonNegativeNumber(value(order, 'total_amount', 'totalAmount')),
    currency: text(value(order, 'currency')).toUpperCase() || 'USD',
    taxAmount: nonNegativeNumber(value(order, 'tax_amount', 'taxAmount')),
    discountAmount: nonNegativeNumber(value(order, 'discount_amount', 'discountAmount')),
    deliveryFee: nonNegativeNumber(value(order, 'delivery_fee', 'deliveryFee')),
    tipAmount: nonNegativeNumber(value(order, 'tip_amount', 'tipAmount')),
    orderType: text(value(order, 'order_type', 'orderType')) || 'UNKNOWN',
    deliveryAddress: text(value(order, 'delivery_address', 'deliveryAddress')),
    specialInstructions: text(value(order, 'special_instructions', 'specialInstructions')),
    estimatedDeliveryTime: text(value(order, 'estimated_delivery_time', 'estimatedDeliveryTime')),
    appliedCouponId: text(value(order, 'applied_coupon_id', 'appliedCouponId')),
    couponId: text(value(order, 'coupon_id', 'couponId')),
    itemCount: itemCounts.get(id) || 0,
    createdAt: text(value(order, 'created_at', 'createdAt')),
  }
}

export function normalizeOrderCustomerOption(customer: any): OrderCustomerOption {
  const id = text(value(customer, 'id'))
  const name = text(value(customer, 'name'))
  const email = text(value(customer, 'email'))
  return {
    id,
    label: name || email || `Customer ${id}`,
  }
}

export function summarizeCommerceOrders(records: CommerceOrderRecord[]): CommerceOrderSummary {
  const currencyTotals = new Map<string, number>()
  for (const record of records)
    currencyTotals.set(record.currency, (currencyTotals.get(record.currency) || 0) + record.totalAmount)

  const status = (record: CommerceOrderRecord): string => record.status.toUpperCase()
  return {
    total: records.length,
    pending: records.filter(record => ['PENDING', 'NEW'].includes(status(record))).length,
    inProgress: records.filter(record => ['PREPARING', 'PROCESSING', 'READY', 'SHIPPED'].includes(status(record))).length,
    completed: records.filter(record => ['DELIVERED', 'COMPLETED', 'PAID'].includes(status(record))).length,
    cancelled: records.filter(record => ['CANCELED', 'CANCELLED', 'REFUNDED'].includes(status(record))).length,
    currencyTotals: [...currencyTotals.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
  }
}
