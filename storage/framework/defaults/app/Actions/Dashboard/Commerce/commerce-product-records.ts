import { commerceTimestamp } from './commerce-record'

export interface CommerceProductRecord {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string
  isAvailable: boolean
  inventoryCount: number
  preparationTime: number
  allergens: string[]
  nutritionalInfo: Record<string, string>
  nutritionalInfoRaw: string
  categoryId: string
  categoryName: string
  manufacturerId: string
  manufacturerName: string
  variantCount: number
  unitCount: number
  reviewCount: number
  createdAt: string
}

export interface CommerceProductSummary {
  total: number
  available: number
  unavailable: number
  outOfStock: number
  totalInventory: number
}

export interface ProductOption {
  id: string
  label: string
}

export interface ProductVariantDetail {
  id: string
  name: string
  type: string
  description: string
  options: string[]
  status: string
}

export interface ProductUnitDetail {
  id: string
  name: string
  abbreviation: string
  type: string
  description: string
  isDefault: boolean
}

export interface ProductReviewSummary {
  total: number
  approved: number
  pending: number
  averageRating: number
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

function optionalText(input: unknown, source: string, field: string): string {
  if (input === null || input === undefined || input === '')
    return ''
  if (typeof input !== 'string')
    throw recordError(source, field, 'a string or null')
  return input.trim()
}

function requiredText(input: unknown, source: string, field: string): string {
  const result = optionalText(input, source, field)
  if (!result)
    throw recordError(source, field, 'a non-empty string')
  return result
}

function identifier(input: unknown, source: string, field = 'id'): string {
  if (typeof input === 'string' && input.trim())
    return input.trim()
  if (typeof input === 'number' && Number.isSafeInteger(input) && input > 0)
    return String(input)
  if (typeof input === 'bigint' && input > 0)
    return String(input)
  throw recordError(source, field, 'a positive integer or non-empty string')
}

function number(input: unknown, source: string, field: string, options: { min?: number, max?: number } = {}): number {
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

function boolean(input: unknown, source: string, field: string): boolean {
  if (input === true || input === 1 || input === '1' || input === 'true')
    return true
  if (input === false || input === 0 || input === '0' || input === 'false')
    return false
  throw recordError(source, field, 'a boolean')
}

function stringArray(input: unknown, source: string, field: string): string[] {
  const raw = optionalText(input, source, field)
  if (!raw)
    return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      throw recordError(source, field, 'a JSON string array')
    if (!parsed.every(item => typeof item === 'string'))
      throw recordError(source, field, 'a JSON string array')
    return parsed.map(item => item.trim()).filter(Boolean)
  }
  catch (error) {
    if (error instanceof TypeError)
      throw error
    if (/^\s*[\[{]/.test(raw))
      throw recordError(source, field, 'valid JSON or a legacy comma-delimited string')
  }

  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function stringRecord(input: unknown, source: string, field: string): Record<string, string> {
  const raw = optionalText(input, source, field)
  if (!raw)
    return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    throw recordError(source, field, 'a valid JSON object')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw recordError(source, field, 'a valid JSON object')
  const entries = Object.entries(parsed)
  if (!entries.every(([, result]) =>
    result === null || ['string', 'number', 'boolean'].includes(typeof result),
  )) {
    throw recordError(source, field, 'a JSON object containing primitive values')
  }
  return Object.fromEntries(entries.map(([key, result]) => [key, result === null ? '' : String(result)]))
}

export function commerceRecordIdentifier(record: any, source: string, ...keys: string[]): string {
  return identifier(value(record, ...(keys.length ? keys : ['id'])), source, keys[0] || 'id')
}

export function normalizeCommerceCurrency(input: unknown): string {
  const currency = requiredText(input, 'Commerce configuration', 'currency').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency))
    throw recordError('Commerce configuration', 'currency', 'a three-letter currency code')
  return currency
}

export function countProductRelations(records: any[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [index, record] of records.entries()) {
    const productId = identifier(value(record, 'product_id', 'productId'), `Product relation ${index + 1}`, 'product_id')
    counts.set(productId, (counts.get(productId) || 0) + 1)
  }
  return counts
}

export function normalizeCommerceProductRecord(
  product: any,
  categories: Map<string, string>,
  manufacturers: Map<string, string>,
  variantCounts: Map<string, number>,
  unitCounts: Map<string, number>,
  reviewCounts: Map<string, number>,
): CommerceProductRecord {
  const id = identifier(value(product, 'id', 'uuid'), 'Product')
  const source = `Product ${id}`
  const categoryValue = value(product, 'category_id', 'categoryId')
  const manufacturerValue = value(product, 'manufacturer_id', 'manufacturerId')
  const categoryId = categoryValue === null || categoryValue === undefined || categoryValue === ''
    ? ''
    : identifier(categoryValue, source, 'category_id')
  const manufacturerId = manufacturerValue === null || manufacturerValue === undefined || manufacturerValue === ''
    ? ''
    : identifier(manufacturerValue, source, 'manufacturer_id')
  const nutritionalInfoRaw = optionalText(value(product, 'nutritional_info', 'nutritionalInfo'), source, 'nutritional_info')

  if (categoryId && !categories.has(categoryId))
    throw new TypeError(`${source}.category_id references missing Category ${categoryId}.`)
  if (manufacturerId && !manufacturers.has(manufacturerId))
    throw new TypeError(`${source}.manufacturer_id references missing Manufacturer ${manufacturerId}.`)

  return {
    id,
    name: requiredText(value(product, 'name'), source, 'name'),
    description: optionalText(value(product, 'description'), source, 'description'),
    price: number(value(product, 'price'), source, 'price', { min: 0 }),
    imageUrl: optionalText(value(product, 'image_url', 'imageUrl'), source, 'image_url'),
    isAvailable: boolean(value(product, 'is_available', 'isAvailable'), source, 'is_available'),
    inventoryCount: number(value(product, 'inventory_count', 'inventoryCount'), source, 'inventory_count', { min: 0 }),
    preparationTime: number(value(product, 'preparation_time', 'preparationTime'), source, 'preparation_time', { min: 1 }),
    allergens: stringArray(value(product, 'allergens'), source, 'allergens'),
    nutritionalInfo: stringRecord(nutritionalInfoRaw, source, 'nutritional_info'),
    nutritionalInfoRaw,
    categoryId,
    categoryName: categoryId ? categories.get(categoryId)! : 'Unassigned category',
    manufacturerId,
    manufacturerName: manufacturerId ? manufacturers.get(manufacturerId)! : 'Unassigned manufacturer',
    variantCount: variantCounts.get(id) || 0,
    unitCount: unitCounts.get(id) || 0,
    reviewCount: reviewCounts.get(id) || 0,
    createdAt: commerceTimestamp(value(product, 'created_at', 'createdAt'), source, 'created_at'),
  }
}

export function normalizeProductOption(record: any): ProductOption {
  const id = identifier(value(record, 'id'), 'Category')
  return { id, label: requiredText(value(record, 'name'), `Category ${id}`, 'name') }
}

export function normalizeManufacturerOption(record: any): ProductOption {
  const id = identifier(value(record, 'id'), 'Manufacturer')
  return { id, label: requiredText(value(record, 'manufacturer'), `Manufacturer ${id}`, 'manufacturer') }
}

export function normalizeProductVariantDetail(record: any): ProductVariantDetail {
  const id = identifier(value(record, 'id'), 'ProductVariant')
  const source = `ProductVariant ${id}`
  return {
    id,
    name: requiredText(value(record, 'variant'), source, 'variant'),
    type: requiredText(value(record, 'type'), source, 'type'),
    description: optionalText(value(record, 'description'), source, 'description'),
    options: stringArray(value(record, 'options'), source, 'options'),
    status: requiredText(value(record, 'status'), source, 'status'),
  }
}

export function normalizeProductUnitDetail(record: any): ProductUnitDetail {
  const id = identifier(value(record, 'id'), 'ProductUnit')
  const source = `ProductUnit ${id}`
  return {
    id,
    name: requiredText(value(record, 'name'), source, 'name'),
    abbreviation: requiredText(value(record, 'abbreviation'), source, 'abbreviation'),
    type: requiredText(value(record, 'type'), source, 'type'),
    description: optionalText(value(record, 'description'), source, 'description'),
    isDefault: boolean(value(record, 'is_default', 'isDefault'), source, 'is_default'),
  }
}

export function summarizeCommerceProducts(records: CommerceProductRecord[]): CommerceProductSummary {
  return {
    total: records.length,
    available: records.filter(record => record.isAvailable).length,
    unavailable: records.filter(record => !record.isAvailable).length,
    outOfStock: records.filter(record => record.inventoryCount === 0).length,
    totalInventory: records.reduce((sum, record) => sum + record.inventoryCount, 0),
  }
}

export function summarizeProductReviews(records: any[]): ProductReviewSummary {
  const ratings = records.map((record, index) =>
    number(value(record, 'rating'), `Review ${index + 1}`, 'rating', { min: 1, max: 5 }),
  )
  const approved = records.filter((record, index) =>
    boolean(value(record, 'is_approved', 'isApproved'), `Review ${index + 1}`, 'is_approved'),
  ).length
  return {
    total: records.length,
    approved,
    pending: records.length - approved,
    averageRating: ratings.length > 0
      ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10
      : 0,
  }
}
