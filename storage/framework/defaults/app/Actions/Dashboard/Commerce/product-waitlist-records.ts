export interface ProductWaitlistRecord {
  id: string
  name: string
  email: string
  phone: string
  quantity: number
  notificationPreference: string
  source: string
  notes: string
  status: string
  productId: string
  customerId: string
  createdAt: string
}

export interface ProductWaitlistSummary {
  total: number
  waiting: number
  notified: number
  purchased: number
  conversionRate: number
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

export function normalizeProductWaitlistRecord(record: any): ProductWaitlistRecord {
  const quantity = Number(value(record, 'quantity'))
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    email: text(value(record, 'email')),
    phone: text(value(record, 'phone')),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    notificationPreference: text(value(record, 'notification_preference', 'notificationPreference')),
    source: text(value(record, 'source')),
    notes: text(value(record, 'notes')),
    status: text(value(record, 'status')).toLowerCase(),
    productId: text(value(record, 'product_id', 'productId')),
    customerId: text(value(record, 'customer_id', 'customerId')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeProductWaitlist(records: ProductWaitlistRecord[]): ProductWaitlistSummary {
  const waiting = records.filter(record => record.status === 'waiting').length
  const notified = records.filter(record => record.status === 'notified').length
  const purchased = records.filter(record => record.status === 'purchased').length
  return {
    total: records.length,
    waiting,
    notified,
    purchased,
    conversionRate: records.length > 0 ? Math.round((purchased / records.length) * 100) : 0,
  }
}
