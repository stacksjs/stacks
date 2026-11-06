import type { CustomerChoice, ProductChoice } from './commerce-choice-records'
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
  /** The waitlisted product's name, read with the entry. */
  productName: string
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

/** A product the entry dialog offers (commerce-choice-records.ts). */
export type ProductWaitlistOption = ProductChoice

/** A customer the entry dialog offers (commerce-choice-records.ts). */
export type ProductWaitlistCustomerOption = CustomerChoice

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

/**
 * An entry as the dashboard shows it. `products` maps each product the entry
 * may reference to its name; an entry for any other product is refused, as is
 * one for a customer outside `customerIds`.
 */
export function normalizeProductWaitlistRecord(
  record: any,
  products?: Map<string, string>,
  customerIds?: Set<string>,
): ProductWaitlistRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'WaitlistProduct')
  const source = `WaitlistProduct ${id}`
  const productId = commerceIdentifier(
    commerceValue(record, 'product_id', 'productId'),
    source,
    'product_id',
  )
  if (products && !products.has(productId))
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
    productName: products?.get(productId) ?? '',
    customerId,
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export { normalizeCustomerChoice as normalizeProductWaitlistCustomerOption, normalizeProductChoice as normalizeProductWaitlistOption } from './commerce-choice-records'

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
