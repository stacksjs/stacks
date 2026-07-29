export interface TaxRateRecord {
  id: string
  name: string
  rate: number
  type: string
  country: string
  region: string
  status: 'active' | 'inactive'
  isDefault: boolean
  createdAt: string
}

export interface TaxRateSummary {
  total: number
  active: number
  countries: number
  averageRate: number
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

export function normalizeTaxRateRecord(record: any): TaxRateRecord {
  const status = text(value(record, 'status')) === 'inactive' ? 'inactive' : 'active'
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    rate: Number(value(record, 'rate') || 0),
    type: text(value(record, 'type')),
    country: text(value(record, 'country')),
    region: text(value(record, 'region')),
    status,
    isDefault: boolean(value(record, 'is_default', 'isDefault')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeTaxRates(records: TaxRateRecord[]): TaxRateSummary {
  const totalRate = records.reduce((sum, record) => sum + record.rate, 0)
  const defaults = records.filter(record => record.isDefault).length
  return {
    total: records.length,
    active: records.filter(record => record.status === 'active').length,
    countries: new Set(records.map(record => record.country).filter(Boolean)).size,
    averageRate: records.length ? totalRate / records.length : 0,
    defaultConflicts: Math.max(0, defaults - 1),
  }
}
