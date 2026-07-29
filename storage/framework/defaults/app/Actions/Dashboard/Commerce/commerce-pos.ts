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

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function deriveCommercePosTaxRate(subtotal: number, taxAmount: number): number {
  if (!Number.isFinite(subtotal) || !Number.isFinite(taxAmount) || subtotal <= 0 || taxAmount < 0)
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
  const id = String(record?.get?.('id') ?? record?.id ?? '')
  const name = String(record?.get?.('name') ?? record?.name ?? '').trim()
  const email = String(record?.get?.('email') ?? record?.email ?? '').trim()
  return {
    id,
    label: name || email || `Customer ${id}`,
    email,
  }
}

export function parseCommercePosLines(input: unknown): CommercePosLineInputResult {
  if (!Array.isArray(input) || input.length === 0)
    return { lines: [], error: 'Add at least one product before checkout.' }
  if (input.length > 100)
    return { lines: [], error: 'A sale may contain at most 100 distinct products.' }

  const merged = new Map<number, CommercePosCheckoutLine>()
  for (const raw of input) {
    const item = raw as Record<string, unknown>
    const productId = Number(item?.productId)
    const quantity = Number(item?.quantity)
    const specialInstructions = String(item?.specialInstructions || '').trim()
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
  const productMap = new Map(products.map(product => [Number(product.id), product]))
  const lines = checkoutLines.map((line) => {
    const product = productMap.get(line.productId)
    if (!product)
      throw new Error(`Product ${line.productId} is no longer available.`)
    if (!product.isAvailable)
      throw new Error(`${product.name || 'This product'} is not available for sale.`)
    const lineTotal = money(product.price * line.quantity)
    return {
      ...line,
      name: product.name,
      unitPrice: product.price,
      lineTotal,
    }
  })
  const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const normalizedTaxRate = Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0
  const taxAmount = money(subtotal * normalizedTaxRate / 100)
  return {
    lines,
    subtotal,
    taxRate: normalizedTaxRate,
    taxAmount,
    totalAmount: money(subtotal + taxAmount),
  }
}

export function selectCommercePosTaxRate(records: any[]): number {
  const active = records.filter((record) => {
    const status = String(record?.get?.('status') ?? record?.status ?? '').toLowerCase()
    return status === 'active'
  })
  const preferred = active.find((record) => {
    const value = record?.get?.('is_default') ?? record?.get?.('isDefault') ?? record?.is_default ?? record?.isDefault
    return value === true || value === 1 || value === '1' || value === 'true'
  }) || active[0]
  const rate = Number(preferred?.get?.('rate') ?? preferred?.rate ?? 0)
  return Number.isFinite(rate) && rate >= 0 ? rate : 0
}
