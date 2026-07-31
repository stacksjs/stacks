import {
  commerceCurrency,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalEmail,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export type PaymentMethod = 'cash' | 'creditCard' | 'debitCard' | 'paypal' | 'applePay' | 'googlePay' | 'bankTransfer' | 'giftCard'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partiallyRefunded' | 'succeeded'

export interface PaymentRecord {
  id: string
  amount: number
  refundAmount: number
  refundRecorded: boolean
  method: PaymentMethod
  status: PaymentStatus
  currency: string
  referenceNumber: string
  cardLastFour: string
  cardBrand: string
  billingEmail: string
  transactionId: string
  paymentProvider: string
  notes: string
  orderId: string
  customerId: string
  createdAt: string
}

export interface PaymentSummary {
  total: number
  successful: number
  currencies: string[]
  capturedByCurrency: Record<string, number>
  refundedByCurrency: Record<string, number>
  successRate: number
}

export interface PaymentRelationshipContext {
  orderIds?: Set<string>
  customerIds?: Set<string>
}

function rawValue(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== undefined)
      return result
  }
  return undefined
}

export function normalizeCardLastFour(input: unknown): string {
  const raw = commerceOptionalString(input, 'Payment', 'card_last_four')
  if (!raw)
    return ''
  if (!/^[\d -]+$/.test(raw))
    throw new TypeError('Payment.card_last_four must contain only card digits and separators.')
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 4 || digits.length > 19)
    throw new TypeError('Payment.card_last_four must contain between 4 and 19 card digits.')
  return digits.slice(-4)
}

export function normalizePaymentRecord(
  record: any,
  relationships: PaymentRelationshipContext = {},
): PaymentRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Payment')
  const source = `Payment ${id}`
  const amount = commerceNumber(commerceValue(record, 'amount'), source, 'amount', {
    min: 1,
    integer: true,
  })
  const rawRefund = rawValue(record, 'refund_amount', 'refundAmount')
  const refundRecorded = rawRefund !== null && rawRefund !== undefined && rawRefund !== ''
  const refundAmount = refundRecorded
    ? commerceNumber(rawRefund, source, 'refund_amount', { min: 0, integer: true })
    : 0
  if (refundAmount > amount)
    throw new TypeError(`${source}.refund_amount must not exceed amount.`)
  const orderId = commerceOptionalIdentifier(
    commerceValue(record, 'order_id', 'orderId'),
    source,
    'order_id',
  )
  if (orderId && relationships.orderIds && !relationships.orderIds.has(orderId))
    throw new TypeError(`${source}.order_id references missing Order ${orderId}.`)
  const customerId = commerceOptionalIdentifier(
    commerceValue(record, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  if (customerId && relationships.customerIds && !relationships.customerIds.has(customerId))
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)

  return {
    id,
    amount,
    refundAmount,
    refundRecorded,
    method: commerceEnum(commerceValue(record, 'method'), source, 'method', [
      'cash',
      'creditCard',
      'debitCard',
      'paypal',
      'applePay',
      'googlePay',
      'bankTransfer',
      'giftCard',
    ]),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'pending',
      'processing',
      'completed',
      'failed',
      'refunded',
      'partiallyRefunded',
      'succeeded',
    ]),
    currency: commerceCurrency(commerceValue(record, 'currency'), source),
    referenceNumber: commerceOptionalString(
      commerceValue(record, 'reference_number', 'referenceNumber'),
      source,
      'reference_number',
    ),
    cardLastFour: normalizeCardLastFour(commerceValue(record, 'card_last_four', 'cardLastFour')),
    cardBrand: commerceOptionalString(
      commerceValue(record, 'card_brand', 'cardBrand'),
      source,
      'card_brand',
    ),
    billingEmail: commerceOptionalEmail(
      commerceValue(record, 'billing_email', 'billingEmail'),
      source,
      'billing_email',
    ),
    transactionId: commerceOptionalString(
      commerceValue(record, 'transaction_id', 'transactionId'),
      source,
      'transaction_id',
    ),
    paymentProvider: commerceOptionalString(
      commerceValue(record, 'payment_provider', 'paymentProvider'),
      source,
      'payment_provider',
    ),
    notes: commerceOptionalString(commerceValue(record, 'notes'), source, 'notes'),
    orderId,
    customerId,
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function isSuccessfulPayment(record: PaymentRecord): boolean {
  return ['completed', 'succeeded', 'partiallyRefunded', 'refunded'].includes(record.status)
}

export function isRefundablePayment(record: PaymentRecord): boolean {
  return ['completed', 'succeeded', 'partiallyRefunded'].includes(record.status)
}

export function summarizePayments(records: PaymentRecord[]): PaymentSummary {
  const successful = records.filter(isSuccessfulPayment)
  const settled = records.filter(record => isSuccessfulPayment(record) || record.status === 'failed')
  const capturedByCurrency: Record<string, number> = {}
  const refundedByCurrency: Record<string, number> = {}
  for (const record of successful)
    capturedByCurrency[record.currency] = (capturedByCurrency[record.currency] || 0) + record.amount
  for (const record of records) {
    if (record.refundAmount > 0)
      refundedByCurrency[record.currency] = (refundedByCurrency[record.currency] || 0) + record.refundAmount
  }
  return {
    total: records.length,
    successful: successful.length,
    currencies: [...new Set(records.map(record => record.currency).filter(Boolean))].sort(),
    capturedByCurrency,
    refundedByCurrency,
    successRate: settled.length
      ? Math.round((successful.length / settled.length) * 1000) / 10
      : 0,
  }
}

function csvCell(value: unknown): string {
  const textValue = String(value ?? '')
  return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue
}

export function paymentsToCsv(records: PaymentRecord[]): string {
  const header = [
    'ID',
    'Created',
    'Status',
    'Method',
    'Amount',
    'Refund amount',
    'Currency',
    'Reference',
    'Provider',
    'Transaction ID',
    'Billing email',
    'Order ID',
  ]
  const rows = records.map(record => [
    record.id,
    record.createdAt,
    record.status,
    record.method,
    record.amount,
    record.refundAmount,
    record.currency,
    record.referenceNumber,
    record.paymentProvider,
    record.transactionId,
    record.billingEmail,
    record.orderId,
  ])
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
}
