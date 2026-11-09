import {
  commerceBoolean,
  commerceIdentifier,
  commerceNumber,
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
