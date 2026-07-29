export interface PaymentRecord {
  id: string
  amount: number
  refundAmount: number
  refundRecorded: boolean
  method: string
  status: string
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

function integer(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) ? Math.round(result) : 0
}

export function normalizeCardLastFour(input: unknown): string {
  const raw = text(input).trim()
  if (!raw)
    return ''
  const digits = raw.replace(/\D/g, '')
  return (digits || raw).slice(-4)
}

export function normalizePaymentRecord(record: any): PaymentRecord {
  const rawRefund = value(record, 'refund_amount', 'refundAmount')
  return {
    id: text(value(record, 'id', 'uuid')),
    amount: integer(value(record, 'amount')),
    refundAmount: integer(rawRefund),
    refundRecorded: rawRefund !== null && rawRefund !== undefined && rawRefund !== '',
    method: text(value(record, 'method')),
    status: text(value(record, 'status')),
    currency: text(value(record, 'currency')) || 'USD',
    referenceNumber: text(value(record, 'reference_number', 'referenceNumber')),
    cardLastFour: normalizeCardLastFour(value(record, 'card_last_four', 'cardLastFour')),
    cardBrand: text(value(record, 'card_brand', 'cardBrand')),
    billingEmail: text(value(record, 'billing_email', 'billingEmail')),
    transactionId: text(value(record, 'transaction_id', 'transactionId')),
    paymentProvider: text(value(record, 'payment_provider', 'paymentProvider')),
    notes: text(value(record, 'notes')),
    orderId: text(value(record, 'order_id', 'orderId')),
    customerId: text(value(record, 'customer_id', 'customerId')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
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
  const textValue = text(value)
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
