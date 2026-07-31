import {
  commerceBoolean,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export interface ManufacturerRecord {
  id: string
  name: string
  description: string
  country: string
  featured: boolean
  productCount: number
  createdAt: string
}

export interface ManufacturerSummary {
  total: number
  featured: number
  countries: number
  linkedProducts: number
}

export function manufacturerProductCounts(
  products: any[],
  manufacturerIds = new Set<string>(),
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const product of products) {
    const id = commerceIdentifier(commerceValue(product, 'id', 'uuid'), 'Product')
    const source = `Product ${id}`
    const manufacturerId = commerceOptionalIdentifier(
      commerceValue(product, 'manufacturer_id', 'manufacturerId'),
      source,
      'manufacturer_id',
    )
    if (!manufacturerId)
      continue
    if (!manufacturerIds.has(manufacturerId))
      throw new TypeError(`${source}.manufacturer_id references missing Manufacturer ${manufacturerId}.`)
    counts.set(manufacturerId, (counts.get(manufacturerId) ?? 0) + 1)
  }
  return counts
}

export function manufacturerIdentifiers(records: any[]): Set<string> {
  return new Set(records.map(record =>
    commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Manufacturer'),
  ))
}

export function normalizeManufacturerRecord(
  record: any,
  productCounts = new Map<string, number>(),
): ManufacturerRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Manufacturer')
  const source = `Manufacturer ${id}`
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'manufacturer', 'name'), source, 'manufacturer'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    country: commerceRequiredString(commerceValue(record, 'country'), source, 'country'),
    featured: commerceBoolean(commerceValue(record, 'featured'), source, 'featured'),
    productCount: commerceNumber(productCounts.get(id) ?? 0, source, 'product_count', {
      min: 0,
      integer: true,
    }),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function summarizeManufacturers(records: ManufacturerRecord[]): ManufacturerSummary {
  return {
    total: records.length,
    featured: records.filter(record => record.featured).length,
    countries: new Set(records.map(record => record.country).filter(Boolean)).size,
    linkedProducts: records.reduce((sum, record) => sum + record.productCount, 0),
  }
}
