import {
  commerceEmail,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

export interface ProductWaitlistOption {
  id: string
  label: string
  detail: string
}

export interface ProductWaitlistCustomerOption extends ProductWaitlistOption {
  email: string
  phone: string
}

export interface ProductWaitlistOptions {
  products: ProductWaitlistOption[]
  customers: ProductWaitlistCustomerOption[]
}

export interface ProductWaitlistWritePayload {
  productId: number
  customerId: number | null
  name: string
  email: string
  phone: string
  quantity: number
  notificationPreference: 'sms' | 'email' | 'both'
  source: string
  notes: string
  status: 'waiting' | 'notified' | 'purchased' | 'cancelled'
}

export function normalizeProductWaitlistRecord(
  record: any,
  productIds?: Set<string>,
  customerIds?: Set<string>,
): ProductWaitlistRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'WaitlistProduct')
  const source = `WaitlistProduct ${id}`
  const productId = commerceIdentifier(
    commerceValue(record, 'product_id', 'productId'),
    source,
    'product_id',
  )
  if (productIds && !productIds.has(productId))
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  const customerId = commerceOptionalIdentifier(
    commerceValue(record, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  if (customerId && customerIds && !customerIds.has(customerId))
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    email: commerceEmail(commerceValue(record, 'email'), source),
    phone: commerceOptionalString(commerceValue(record, 'phone'), source, 'phone'),
    quantity: commerceNumber(commerceValue(record, 'quantity'), source, 'quantity', {
      min: 1,
      integer: true,
    }),
    notificationPreference: commerceEnum(
      commerceValue(record, 'notification_preference', 'notificationPreference'),
      source,
      'notification_preference',
      ['sms', 'email', 'both'],
    ),
    source: commerceRequiredString(commerceValue(record, 'source'), source, 'source'),
    notes: commerceOptionalString(commerceValue(record, 'notes'), source, 'notes'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'waiting',
      'notified',
      'purchased',
      'cancelled',
    ]),
    productId,
    customerId,
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function normalizeProductWaitlistOption(record: any): ProductWaitlistOption {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Product')
  const source = `Product ${id}`
  const inventory = commerceNumber(
    commerceValue(record, 'inventory_count', 'inventoryCount'),
    source,
    'inventory_count',
    { min: 0, integer: true },
  )
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: `${inventory} in inventory`,
  }
}

export function normalizeProductWaitlistCustomerOption(record: any): ProductWaitlistCustomerOption {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  const email = commerceEmail(commerceValue(record, 'email'), source)
  const phone = commerceOptionalString(commerceValue(record, 'phone'), source, 'phone')
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: email || phone,
    email,
    phone,
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
