import { db } from '@stacksjs/database'

type LicenseKeyWriteData = Record<string, unknown>

const templates = ['Standard License', 'Premium License', 'Enterprise License'] as const
const statuses = ['active', 'inactive', 'unassigned'] as const

export class LicenseKeyInputError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'LicenseKeyInputError'
  }
}

function mergedValue(
  input: LicenseKeyWriteData,
  current: LicenseKeyWriteData | undefined,
  key: string,
): unknown {
  return input[key] !== undefined ? input[key] : current?.[key]
}

function optionalId(
  input: LicenseKeyWriteData,
  current: LicenseKeyWriteData | undefined,
  key: string,
  label: string,
): number | null {
  const value = mergedValue(input, current, key)
  if (value === undefined || value === null || value === '')
    return null
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1)
    throw new LicenseKeyInputError(`${label} must be a positive integer or null.`)
  return id
}

function expiryTimestamp(value: unknown): number {
  if (typeof value === 'number')
    return value > 2147483647 ? Math.floor(value / 1000) : value
  if (typeof value === 'string' && /^\d{10,13}$/.test(value))
    return value.length === 13 ? Math.floor(Number(value) / 1000) : Number(value)
  if (typeof value === 'string') {
    const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value)
      ? `${value.replace(' ', 'T')}Z`
      : value
    return Math.floor(new Date(normalized).getTime() / 1000)
  }
  return Number.NaN
}

export async function validateLicenseKeyWrite(
  input: LicenseKeyWriteData,
  current?: LicenseKeyWriteData,
): Promise<LicenseKeyWriteData> {
  const key = String(mergedValue(input, current, 'key') || '').trim().toUpperCase()
  const template = String(mergedValue(input, current, 'template') || '')
  const status = String(mergedValue(input, current, 'status') || '')
  const expiryDate = expiryTimestamp(mergedValue(input, current, 'expiry_date'))
  const customerId = optionalId(input, current, 'customer_id', 'Customer')
  const productId = optionalId(input, current, 'product_id', 'Product')
  const orderId = optionalId(input, current, 'order_id', 'Order')

  if (!/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/.test(key))
    throw new LicenseKeyInputError('License key must use five groups of four uppercase letters or numbers.')
  if (!templates.includes(template as typeof templates[number]))
    throw new LicenseKeyInputError(`Template must be one of: ${templates.join(', ')}.`)
  if (!statuses.includes(status as typeof statuses[number]))
    throw new LicenseKeyInputError(`Status must be one of: ${statuses.join(', ')}.`)
  if (!Number.isSafeInteger(expiryDate) || expiryDate < 0 || expiryDate > 2147483647)
    throw new LicenseKeyInputError('Expiry date must be a Unix timestamp between 1970 and 2038.')

  const [customer, product, order] = await Promise.all([
    customerId
      ? db.selectFrom('customers').where('id', '=', customerId).select('id').executeTakeFirst()
      : null,
    productId
      ? db.selectFrom('products').where('id', '=', productId).select('id').executeTakeFirst()
      : null,
    orderId
      ? db.selectFrom('orders').where('id', '=', orderId).select(['id', 'customer_id']).executeTakeFirst()
      : null,
  ])
  if (customerId && !customer)
    throw new LicenseKeyInputError(`Customer ${customerId} was not found.`)
  if (productId && !product)
    throw new LicenseKeyInputError(`Product ${productId} was not found.`)
  if (orderId && !order)
    throw new LicenseKeyInputError(`Order ${orderId} was not found.`)
  if (customerId && order?.customer_id && Number(order.customer_id) !== customerId) {
    throw new LicenseKeyInputError(
      `Order ${orderId} belongs to Customer ${order.customer_id}, not Customer ${customerId}.`,
    )
  }

  return {
    ...input,
    key,
    template,
    expiry_date: expiryDate,
    status,
    customer_id: customerId,
    product_id: productId,
    order_id: orderId,
  }
}
