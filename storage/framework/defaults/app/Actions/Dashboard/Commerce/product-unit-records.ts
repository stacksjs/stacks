export interface ProductUnitRecord {
  id: string
  name: string
  abbreviation: string
  type: string
  description: string
  isDefault: boolean
  productId: string
  productName: string
  createdAt: string
}

export interface ProductUnitOption {
  id: string
  name: string
}

export interface ProductUnitSummary {
  total: number
  defaults: number
  types: number
  linkedProducts: number
  defaultConflicts: number
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

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

export function productUnitOptions(products: any[]): ProductUnitOption[] {
  return products
    .map(product => ({
      id: text(value(product, 'id', 'uuid')),
      name: text(value(product, 'name')),
    }))
    .filter(product => product.id && product.name)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function normalizeProductUnitRecord(
  record: any,
  products = new Map<string, string>(),
): ProductUnitRecord {
  const productId = text(value(record, 'product_id', 'productId'))
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    abbreviation: text(value(record, 'abbreviation')),
    type: text(value(record, 'type')),
    description: text(value(record, 'description')),
    isDefault: boolean(value(record, 'is_default', 'isDefault')),
    productId,
    productName: products.get(productId) || '',
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeProductUnits(records: ProductUnitRecord[]): ProductUnitSummary {
  const defaultsByType = new Map<string, number>()
  for (const record of records) {
    if (record.isDefault && record.type)
      defaultsByType.set(record.type, (defaultsByType.get(record.type) || 0) + 1)
  }

  return {
    total: records.length,
    defaults: records.filter(record => record.isDefault).length,
    types: new Set(records.map(record => record.type).filter(Boolean)).size,
    linkedProducts: new Set(records.map(record => record.productId).filter(Boolean)).size,
    defaultConflicts: [...defaultsByType.values()].filter(count => count > 1).length,
  }
}
