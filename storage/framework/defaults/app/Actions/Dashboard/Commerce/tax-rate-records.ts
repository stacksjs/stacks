import {
  commerceBoolean,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export type TaxRateRegion = 'North America' | 'South America' | 'Europe' | 'Asia' | 'Africa' | 'Oceania' | 'Antarctica'

export interface TaxRateRecord {
  id: string
  name: string
  rate: number
  type: string
  country: string
  region: TaxRateRegion
  status: 'active' | 'inactive'
  isDefault: boolean
  /** Stable identifier application code matches on, independent of `name`. */
  code: string
  /** Whether a qualifying exemption stops this component being charged. */
  exemptible: boolean
  createdAt: string
}

export interface TaxRateSummary {
  total: number
  active: number
  countries: number
  averageRate: number
  defaultConflicts: number
}

export function normalizeTaxRateRecord(record: any): TaxRateRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'TaxRate')
  const source = `TaxRate ${id}`
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    rate: commerceNumber(commerceValue(record, 'rate'), source, 'rate', { min: 0, max: 100 }),
    type: commerceRequiredString(commerceValue(record, 'type'), source, 'type'),
    country: commerceRequiredString(commerceValue(record, 'country'), source, 'country'),
    region: commerceEnum(commerceValue(record, 'region'), source, 'region', [
      'North America',
      'South America',
      'Europe',
      'Asia',
      'Africa',
      'Oceania',
      'Antarctica',
    ]),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', ['active', 'inactive']),
    isDefault: commerceBoolean(commerceValue(record, 'is_default', 'isDefault'), source, 'is_default'),
    // Optional, both of them: a rate created before these columns existed has
    // neither, and a dashboard that throws on an older row is worse than one
    // that shows it without a badge.
    code: String(commerceValue(record, 'code') ?? ''),
    exemptible: Boolean(commerceValue(record, 'exemptible') ?? false),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
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
