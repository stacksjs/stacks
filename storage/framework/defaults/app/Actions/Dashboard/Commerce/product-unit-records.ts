import {
  commerceBoolean,
  commerceIdentifier,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

export function productUnitOptions(products: any[]): ProductUnitOption[] {
  return products
    .map((product) => {
      const id = commerceIdentifier(commerceValue(product, 'id', 'uuid'), 'Product')
      return {
        id,
        name: commerceRequiredString(commerceValue(product, 'name'), `Product ${id}`, 'name'),
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function normalizeProductUnitRecord(
  record: any,
  products = new Map<string, string>(),
): ProductUnitRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'ProductUnit')
  const source = `ProductUnit ${id}`
  const productId = commerceOptionalIdentifier(
    commerceValue(record, 'product_id', 'productId'),
    source,
    'product_id',
  )
  const productName = productId ? products.get(productId) : undefined
  if (productId && !productName)
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    abbreviation: commerceRequiredString(
      commerceValue(record, 'abbreviation'),
      source,
      'abbreviation',
    ),
    type: commerceRequiredString(commerceValue(record, 'type'), source, 'type'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    isDefault: commerceBoolean(
      commerceValue(record, 'is_default', 'isDefault'),
      source,
      'is_default',
    ),
    productId,
    productName: productName || '',
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function summarizeProductUnits(records: ProductUnitRecord[]): ProductUnitSummary {
  const defaultsByType = new Map<string, number>()
  for (const record of records) {
    if (record.isDefault && record.type)
      defaultsByType.set(record.type, (defaultsByType.get(record.type) ?? 0) + 1)
  }

  return {
    total: records.length,
    defaults: records.filter(record => record.isDefault).length,
    types: new Set(records.map(record => record.type).filter(Boolean)).size,
    linkedProducts: new Set(records.map(record => record.productId).filter(Boolean)).size,
    defaultConflicts: [...defaultsByType.values()].filter(count => count > 1).length,
  }
}
