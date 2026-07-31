import {
  commerceEmail,
  commerceEnum,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export const licenseKeyStatuses = ['active', 'inactive', 'unassigned'] as const
export const licenseKeyTemplates = ['Standard License', 'Premium License', 'Enterprise License'] as const

export type LicenseKeyStatus = typeof licenseKeyStatuses[number]
export type LicenseKeyTemplate = typeof licenseKeyTemplates[number]

export interface LicenseKeyRelatedSummary {
  id: number
  label: string
  detail?: string
}

export interface LicenseKeyRecord {
  id: number
  key: string
  template: LicenseKeyTemplate
  expiry_date: string
  status: LicenseKeyStatus
  customer_id: number | null
  product_id: number | null
  order_id: number | null
  created_at: string
  updated_at: string
  uuid: string
  customer: LicenseKeyRelatedSummary | null
  product: LicenseKeyRelatedSummary | null
  order: LicenseKeyRelatedSummary | null
}

function numericIdentifier(input: unknown, source: string, field = 'id'): number {
  const value = commerceNumber(input, source, field, { integer: true, min: 1 })
  if (!Number.isSafeInteger(value))
    throw new TypeError(`${source}.${field} must be a safe positive integer.`)
  return value
}

function optionalNumericIdentifier(input: unknown, source: string, field: string): number | null {
  const value = commerceOptionalIdentifier(input, source, field)
  return value ? numericIdentifier(value, source, field) : null
}

export function normalizeLicenseKeyCustomer(record: any): LicenseKeyRelatedSummary {
  const id = numericIdentifier(commerceValue(record, 'id'), 'Customer')
  const source = `Customer ${id}`
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: commerceEmail(commerceValue(record, 'email'), source),
  }
}

export function normalizeLicenseKeyProduct(record: any): LicenseKeyRelatedSummary {
  const id = numericIdentifier(commerceValue(record, 'id'), 'Product')
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), `Product ${id}`, 'name'),
  }
}

export function normalizeLicenseKeyOrder(record: any): LicenseKeyRelatedSummary {
  const id = numericIdentifier(commerceValue(record, 'id'), 'Order')
  return {
    id,
    label: `Order #${id}`,
    detail: commerceRequiredString(commerceValue(record, 'status'), `Order ${id}`, 'status'),
  }
}

export function normalizeLicenseKeyRecord(
  record: any,
  customers: ReadonlyMap<number, LicenseKeyRelatedSummary>,
  products: ReadonlyMap<number, LicenseKeyRelatedSummary>,
  orders: ReadonlyMap<number, LicenseKeyRelatedSummary>,
): LicenseKeyRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'LicenseKey')
  const source = `LicenseKey ${id}`
  const key = commerceRequiredString(commerceValue(record, 'key'), source, 'key').toUpperCase()
  if (!/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/.test(key))
    throw new TypeError(`${source}.key must use five groups of four uppercase letters or numbers.`)

  const customerId = optionalNumericIdentifier(commerceValue(record, 'customer_id', 'customerId'), source, 'customer_id')
  const productId = optionalNumericIdentifier(commerceValue(record, 'product_id', 'productId'), source, 'product_id')
  const orderId = optionalNumericIdentifier(commerceValue(record, 'order_id', 'orderId'), source, 'order_id')
  const customer = customerId ? customers.get(customerId) : undefined
  const product = productId ? products.get(productId) : undefined
  const order = orderId ? orders.get(orderId) : undefined

  if (customerId && !customer)
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)
  if (productId && !product)
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  if (orderId && !order)
    throw new TypeError(`${source}.order_id references missing Order ${orderId}.`)

  return {
    id,
    key,
    template: commerceEnum(commerceValue(record, 'template'), source, 'template', licenseKeyTemplates),
    expiry_date: commerceTimestamp(commerceValue(record, 'expiry_date', 'expiryDate'), source, 'expiry_date'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', licenseKeyStatuses),
    customer_id: customerId,
    product_id: productId,
    order_id: orderId,
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
    customer: customer || null,
    product: product || null,
    order: order || null,
  }
}

export function indexLicenseKeyOptions(
  options: LicenseKeyRelatedSummary[],
): Map<number, LicenseKeyRelatedSummary> {
  const result = new Map<number, LicenseKeyRelatedSummary>()
  for (const option of options) {
    if (result.has(option.id))
      throw new TypeError(`Duplicate relationship option ${option.id}.`)
    result.set(option.id, option)
  }
  return result
}
