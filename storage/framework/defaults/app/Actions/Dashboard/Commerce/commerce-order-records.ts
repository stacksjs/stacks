import {
  commerceCurrency,
  commerceEmail,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

export interface OrderCustomerContext {
  name: string
  email: string
}

export function normalizeCommerceOrderRecord(
  order: any,
  customers: Map<string, OrderCustomerContext>,
  itemCounts: Map<string, number>,
  couponIds = new Set<string>(),
): CommerceOrderRecord {
  const id = commerceIdentifier(commerceValue(order, 'id', 'uuid'), 'Order')
  const source = `Order ${id}`
  const customerId = commerceOptionalIdentifier(
    commerceValue(order, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  const customer = customers.get(customerId)
  if (customerId && !customer)
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)

  const couponId = commerceOptionalIdentifier(
    commerceValue(order, 'coupon_id', 'couponId'),
    source,
    'coupon_id',
  )
  if (couponId && !couponIds.has(couponId))
    throw new TypeError(`${source}.coupon_id references missing Coupon ${couponId}.`)

  return {
    id,
    customerId,
    customerName: customer?.name || '',
    customerEmail: customer?.email || '',
    status: commerceRequiredString(commerceValue(order, 'status'), source, 'status'),
    totalAmount: commerceNumber(
      commerceValue(order, 'total_amount', 'totalAmount'),
      source,
      'total_amount',
      { min: 0 },
    ),
    currency: commerceCurrency(commerceValue(order, 'currency'), source),
    taxAmount: commerceNumber(
      commerceValue(order, 'tax_amount', 'taxAmount'),
      source,
      'tax_amount',
      { min: 0 },
    ),
    discountAmount: commerceNumber(
      commerceValue(order, 'discount_amount', 'discountAmount'),
      source,
      'discount_amount',
      { min: 0 },
    ),
    deliveryFee: commerceNumber(
      commerceValue(order, 'delivery_fee', 'deliveryFee'),
      source,
      'delivery_fee',
      { min: 0 },
    ),
    tipAmount: commerceNumber(
      commerceValue(order, 'tip_amount', 'tipAmount'),
      source,
      'tip_amount',
      { min: 0 },
    ),
    orderType: commerceRequiredString(
      commerceValue(order, 'order_type', 'orderType'),
      source,
      'order_type',
    ),
    deliveryAddress: commerceOptionalString(
      commerceValue(order, 'delivery_address', 'deliveryAddress'),
      source,
      'delivery_address',
    ),
    specialInstructions: commerceOptionalString(
      commerceValue(order, 'special_instructions', 'specialInstructions'),
      source,
      'special_instructions',
    ),
    estimatedDeliveryTime: commerceOptionalTimestamp(
      commerceValue(order, 'estimated_delivery_time', 'estimatedDeliveryTime'),
      source,
      'estimated_delivery_time',
    ),
    appliedCouponId: commerceOptionalString(
      commerceValue(order, 'applied_coupon_id', 'appliedCouponId'),
      source,
      'applied_coupon_id',
    ),
    couponId,
    itemCount: commerceNumber(itemCounts.get(id) ?? 0, source, 'item_count', {
      min: 0,
      integer: true,
    }),
    createdAt: commerceTimestamp(commerceValue(order, 'created_at', 'createdAt'), source),
  }
}

export function normalizeOrderCustomerOption(customer: any): OrderCustomerOption {
  const id = commerceIdentifier(commerceValue(customer, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  return {
    id,
    label: commerceRequiredString(commerceValue(customer, 'name'), source, 'name'),
  }
}

export function normalizeOrderCustomerContext(customer: any): { id: string, context: OrderCustomerContext } {
  const id = commerceIdentifier(commerceValue(customer, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  return {
    id,
    context: {
      name: commerceRequiredString(commerceValue(customer, 'name'), source, 'name'),
      email: commerceEmail(commerceValue(customer, 'email'), source),
    },
  }
}

export function normalizeOrderCouponId(coupon: any): string {
  return commerceIdentifier(commerceValue(coupon, 'id', 'uuid'), 'Coupon')
}

export function addOrderItemQuantity(
  item: any,
  orderIds: Set<string>,
  itemCounts: Map<string, number>,
): void {
  const id = commerceIdentifier(commerceValue(item, 'id'), 'OrderItem')
  const source = `OrderItem ${id}`
  const orderId = commerceIdentifier(
    commerceValue(item, 'order_id', 'orderId'),
    source,
    'order_id',
  )
  if (!orderIds.has(orderId))
    throw new TypeError(`${source}.order_id references missing Order ${orderId}.`)
  const quantity = commerceNumber(commerceValue(item, 'quantity'), source, 'quantity', {
    min: 1,
    integer: true,
  })
  itemCounts.set(orderId, (itemCounts.get(orderId) ?? 0) + quantity)
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
