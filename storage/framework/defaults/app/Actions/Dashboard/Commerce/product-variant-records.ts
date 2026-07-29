export interface ProductVariantRecord {
  id: string
  variant: string
  type: string
  description: string
  options: string[]
  status: 'active' | 'inactive' | 'draft'
  productId: string
  productName: string
  createdAt: string
}

export interface ProductVariantOption {
  id: string
  name: string
}

export interface ProductVariantSummary {
  total: number
  active: number
  draft: number
  linkedProducts: number
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

export function parseVariantOptions(input: unknown): string[] {
  if (Array.isArray(input))
    return input.map(text).map(option => option.trim()).filter(Boolean)
  const raw = text(input).trim()
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(text).map(option => option.trim()).filter(Boolean)
      : []
  }
  catch {
    return raw.split(',').map(option => option.trim()).filter(Boolean)
  }
}

export function productVariantOptions(products: any[]): ProductVariantOption[] {
  return products
    .map(product => ({ id: text(value(product, 'id', 'uuid')), name: text(value(product, 'name')) }))
    .filter(product => product.id && product.name)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function normalizeProductVariantRecord(
  record: any,
  productNames = new Map<string, string>(),
): ProductVariantRecord {
  const productId = text(value(record, 'product_id', 'productId'))
  const rawStatus = text(value(record, 'status'))
  const status = rawStatus === 'inactive' || rawStatus === 'draft' ? rawStatus : 'active'
  return {
    id: text(value(record, 'id', 'uuid')),
    variant: text(value(record, 'variant')),
    type: text(value(record, 'type')),
    description: text(value(record, 'description')),
    options: parseVariantOptions(value(record, 'options')),
    status,
    productId,
    productName: productNames.get(productId) || '',
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeProductVariants(records: ProductVariantRecord[]): ProductVariantSummary {
  return {
    total: records.length,
    active: records.filter(record => record.status === 'active').length,
    draft: records.filter(record => record.status === 'draft').length,
    linkedProducts: new Set(records.map(record => record.productId).filter(Boolean)).size,
  }
}
