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

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function nonNegativeNumber(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) && result >= 0 ? result : 0
}

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

function stringArray(input: unknown): string[] {
  const raw = text(input).trim()
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed))
      return parsed.map(item => text(item).trim()).filter(Boolean)
  }
  catch {
    // Preserve legacy comma-delimited values below.
  }
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}

function stringRecord(input: unknown): Record<string, string> {
  const raw = text(input).trim()
  if (!raw)
    return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([key, result]) => [key, text(result)]))
    }
  }
  catch {
    return {}
  }
  return {}
}

export function countProductRelations(records: any[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const productId = text(value(record, 'product_id', 'productId'))
    if (productId)
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
  const id = text(value(product, 'id', 'uuid'))
  const categoryId = text(value(product, 'category_id', 'categoryId'))
  const manufacturerId = text(value(product, 'manufacturer_id', 'manufacturerId'))
  const nutritionalInfoRaw = text(value(product, 'nutritional_info', 'nutritionalInfo'))
  return {
    id,
    name: text(value(product, 'name')),
    description: text(value(product, 'description')),
    price: nonNegativeNumber(value(product, 'price')),
    imageUrl: text(value(product, 'image_url', 'imageUrl')),
    isAvailable: boolean(value(product, 'is_available', 'isAvailable')),
    inventoryCount: nonNegativeNumber(value(product, 'inventory_count', 'inventoryCount')),
    preparationTime: nonNegativeNumber(value(product, 'preparation_time', 'preparationTime')),
    allergens: stringArray(value(product, 'allergens')),
    nutritionalInfo: stringRecord(nutritionalInfoRaw),
    nutritionalInfoRaw,
    categoryId,
    categoryName: categories.get(categoryId) || (categoryId ? `Category ${categoryId}` : 'Unassigned category'),
    manufacturerId,
    manufacturerName: manufacturers.get(manufacturerId) || (manufacturerId ? `Manufacturer ${manufacturerId}` : 'Unassigned manufacturer'),
    variantCount: variantCounts.get(id) || 0,
    unitCount: unitCounts.get(id) || 0,
    reviewCount: reviewCounts.get(id) || 0,
    createdAt: text(value(product, 'created_at', 'createdAt')),
  }
}

export function normalizeProductOption(record: any): ProductOption {
  const id = text(value(record, 'id'))
  const label = text(value(record, 'name'))
  return { id, label: label || `Record ${id}` }
}

export function normalizeManufacturerOption(record: any): ProductOption {
  const id = text(value(record, 'id'))
  const label = text(value(record, 'manufacturer'))
  return { id, label: label || `Record ${id}` }
}

export function normalizeProductVariantDetail(record: any): ProductVariantDetail {
  return {
    id: text(value(record, 'id')),
    name: text(value(record, 'variant')),
    type: text(value(record, 'type')),
    description: text(value(record, 'description')),
    options: stringArray(value(record, 'options')),
    status: text(value(record, 'status')),
  }
}

export function normalizeProductUnitDetail(record: any): ProductUnitDetail {
  return {
    id: text(value(record, 'id')),
    name: text(value(record, 'name')),
    abbreviation: text(value(record, 'abbreviation')),
    type: text(value(record, 'type')),
    description: text(value(record, 'description')),
    isDefault: boolean(value(record, 'is_default', 'isDefault')),
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
  const ratings = records.map(record => nonNegativeNumber(value(record, 'rating')))
  const approved = records.filter(record => boolean(value(record, 'is_approved', 'isApproved'))).length
  return {
    total: records.length,
    approved,
    pending: records.length - approved,
    averageRating: ratings.length > 0
      ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10
      : 0,
  }
}
