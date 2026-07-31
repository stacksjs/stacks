import type { CommerceProductRecord } from './commerce-product-records'

export interface CommercePosProduct {
  id: string
  name: string
  description: string
  price: number
  isAvailable: boolean
  inventoryCount: number
  preparationTime: number
  allergens: string[]
  categoryId: string
  categoryName: string
}

export interface CommercePosCustomer {
  id: string
  label: string
  email: string
}

export interface CommercePosCheckoutLine {
  productId: number
  quantity: number
  specialInstructions: string
}

export interface CommercePosSaleLine extends CommercePosCheckoutLine {
  name: string
  unitPrice: number
  lineTotal: number
}

export interface CommercePosSale {
  lines: CommercePosSaleLine[]
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
}

export interface CommercePosLineInputResult {
  lines: CommercePosCheckoutLine[]
  error: string
}

export class CommercePosAvailabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommercePosAvailabilityError'
  }
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function recordError(source: string, field: string, expectation: string): TypeError {
  return new TypeError(`${source}.${field} must be ${expectation}.`)
}

function identifier(input: unknown, source: string, field = 'id'): string {
  if (typeof input === 'string' && input.trim())
    return input.trim()
  if (typeof input === 'number' && Number.isSafeInteger(input) && input > 0)
    return String(input)
  throw recordError(source, field, 'a positive integer or non-empty string')
}

function requiredText(input: unknown, source: string, field: string): string {
  if (typeof input !== 'string' || !input.trim())
    throw recordError(source, field, 'a non-empty string')
  return input.trim()
}

function storedNumber(
  input: unknown,
  source: string,
  field: string,
  options: { min?: number, max?: number } = {},
): number {
  const result = typeof input === 'number'
    ? input
    : typeof input === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(input.trim())
      ? Number(input)
      : Number.NaN
  if (!Number.isFinite(result))
    throw recordError(source, field, 'a finite number')
  if (options.min !== undefined && result < options.min)
    throw recordError(source, field, `at least ${options.min}`)
  if (options.max !== undefined && result > options.max)
    throw recordError(source, field, `at most ${options.max}`)
  return result
}

function storedBoolean(input: unknown, source: string, field: string): boolean {
  if (input === true || input === 1 || input === '1' || input === 'true')
    return true
  if (input === false || input === 0 || input === '0' || input === 'false')
    return false
  throw recordError(source, field, 'a boolean')
}

export function deriveCommercePosTaxRate(subtotal: number, taxAmount: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0)
    throw new TypeError('Receipt subtotal must be a non-negative finite number.')
  if (!Number.isFinite(taxAmount) || taxAmount < 0)
    throw new TypeError('Receipt tax amount must be a non-negative finite number.')
  if (subtotal === 0 && taxAmount > 0)
    throw new TypeError('A zero-subtotal receipt cannot contain tax.')
  if (subtotal === 0)
    return 0
  return Math.round((taxAmount / subtotal * 100 + Number.EPSILON) * 10000) / 10000
}

export function normalizeCommercePosProduct(record: CommerceProductRecord): CommercePosProduct {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    price: record.price,
    isAvailable: record.isAvailable,
    inventoryCount: record.inventoryCount,
    preparationTime: record.preparationTime,
    allergens: record.allergens,
    categoryId: record.categoryId,
    categoryName: record.categoryName,
  }
}

export function normalizeCommercePosCustomer(record: any): CommercePosCustomer {
  const id = identifier(value(record, 'id'), 'Customer')
  const source = `Customer ${id}`
  const name = requiredText(value(record, 'name'), source, 'name')
  const email = requiredText(value(record, 'email'), source, 'email')
  return {
    id,
    label: name,
    email,
  }
}

export function isCommercePosCustomerActive(record: any): boolean {
  const id = identifier(value(record, 'id'), 'Customer')
  const status = requiredText(value(record, 'status'), `Customer ${id}`, 'status')
  if (status !== 'Active' && status !== 'Inactive')
    throw recordError(`Customer ${id}`, 'status', 'Active or Inactive')
  return status === 'Active'
}

export function parseCommercePosLines(input: unknown): CommercePosLineInputResult {
  if (!Array.isArray(input) || input.length === 0)
    return { lines: [], error: 'Add at least one product before checkout.' }
  if (input.length > 100)
    return { lines: [], error: 'A sale may contain at most 100 distinct products.' }

  const merged = new Map<number, CommercePosCheckoutLine>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return { lines: [], error: 'Every sale line must be an object.' }
    const item = raw as Record<string, unknown>
    const productId = typeof item.productId === 'number' ? item.productId : Number.NaN
    const quantity = typeof item.quantity === 'number' ? item.quantity : Number.NaN
    const specialInstructions = item.specialInstructions === undefined || item.specialInstructions === null
      ? ''
      : typeof item.specialInstructions === 'string'
        ? item.specialInstructions.trim()
        : ''
    if (item.specialInstructions !== undefined && item.specialInstructions !== null && typeof item.specialInstructions !== 'string')
      return { lines: [], error: 'Line instructions must be text.' }
    if (!Number.isInteger(productId) || productId <= 0)
      return { lines: [], error: 'Every sale line must reference a valid product.' }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999)
      return { lines: [], error: 'Every sale quantity must be between 1 and 999.' }
    if (specialInstructions.length > 500)
      return { lines: [], error: 'Line instructions must be 500 characters or fewer.' }

    const existing = merged.get(productId)
    const nextQuantity = (existing?.quantity || 0) + quantity
    if (nextQuantity > 999)
      return { lines: [], error: 'The combined quantity for a product may not exceed 999.' }
    merged.set(productId, {
      productId,
      quantity: nextQuantity,
      specialInstructions: specialInstructions || existing?.specialInstructions || '',
    })
  }
  return { lines: [...merged.values()], error: '' }
}

export function calculateCommercePosSale(
  products: CommercePosProduct[],
  checkoutLines: CommercePosCheckoutLine[],
  taxRate: number,
): CommercePosSale {
  const productMap = new Map(products.map((product) => {
    const id = Number(product.id)
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new TypeError(`Product id "${product.id}" is invalid.`)
    if (!Number.isFinite(product.price) || product.price < 0)
      throw new TypeError(`Product ${id} has an invalid price.`)
    if (!Number.isSafeInteger(product.inventoryCount) || product.inventoryCount < 0)
      throw new TypeError(`Product ${id} has an invalid inventory count.`)
    return [id, product] as const
  }))
  const lines = checkoutLines.map((line) => {
    const product = productMap.get(line.productId)
    if (!product)
      throw new CommercePosAvailabilityError(`Product ${line.productId} is no longer available.`)
    if (!product.isAvailable)
      throw new CommercePosAvailabilityError(`${product.name} is not available for sale.`)
    if (line.quantity > product.inventoryCount)
      throw new CommercePosAvailabilityError(`${product.name} has only ${product.inventoryCount} available.`)
    const lineTotal = money(product.price * line.quantity)
    return {
      ...line,
      name: product.name,
      unitPrice: product.price,
      lineTotal,
    }
  })
  const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    throw new TypeError('Tax rate must be between 0 and 100.')
  const taxAmount = money(subtotal * taxRate / 100)
  return {
    lines,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount: money(subtotal + taxAmount),
  }
}

export function selectCommercePosTaxRate(records: any[]): number {
  const normalized = records.map((record) => {
    const id = identifier(value(record, 'id'), 'TaxRate')
    const source = `TaxRate ${id}`
    const status = requiredText(value(record, 'status'), source, 'status')
    if (status !== 'active' && status !== 'inactive')
      throw recordError(source, 'status', 'active or inactive')
    return {
      status,
      isDefault: storedBoolean(value(record, 'is_default', 'isDefault'), source, 'is_default'),
      rate: storedNumber(value(record, 'rate'), source, 'rate', { min: 0, max: 100 }),
    }
  })
  const active = normalized.filter(record => record.status === 'active')
  const preferred = active.find(record => record.isDefault) || active[0]
  return preferred?.rate ?? 0
}
