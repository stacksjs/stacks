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

export function manufacturerProductCounts(products: any[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const product of products) {
    const manufacturerId = text(value(product, 'manufacturer_id', 'manufacturerId'))
    if (manufacturerId)
      counts.set(manufacturerId, (counts.get(manufacturerId) || 0) + 1)
  }
  return counts
}

export function normalizeManufacturerRecord(
  record: any,
  productCounts = new Map<string, number>(),
): ManufacturerRecord {
  const id = text(value(record, 'id', 'uuid'))
  return {
    id,
    name: text(value(record, 'manufacturer', 'name')),
    description: text(value(record, 'description')),
    country: text(value(record, 'country')),
    featured: boolean(value(record, 'featured')),
    productCount: productCounts.get(id) || 0,
    createdAt: text(value(record, 'created_at', 'createdAt')),
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
