import { describe, expect, it } from 'bun:test'
import { normalizeTaxRateRecord, summarizeTaxRates } from './tax-rate-records'

describe('dashboard tax rate records', () => {
  it('normalizes persisted TaxRate columns', () => {
    expect(normalizeTaxRateRecord({
      id: 4,
      name: 'Standard VAT',
      rate: '20',
      type: 'VAT',
      country: 'France',
      region: 'Europe',
      status: 'active',
      is_default: 1,
      created_at: '2026-07-29 10:00:00',
    })).toEqual({
      id: '4',
      name: 'Standard VAT',
      rate: 20,
      type: 'VAT',
      country: 'France',
      region: 'Europe',
      status: 'active',
      isDefault: true,
      createdAt: '2026-07-29 10:00:00',
    })
  })

  it('summarizes rates and reports competing defaults', () => {
    const records = [
      normalizeTaxRateRecord({ id: 1, name: 'VAT', rate: 20, country: 'France', status: 'active', is_default: true }),
      normalizeTaxRateRecord({ id: 2, name: 'GST', rate: 10, country: 'Australia', status: 'inactive', is_default: true }),
      normalizeTaxRateRecord({ id: 3, name: 'Reduced VAT', rate: 5, country: 'France', status: 'active', is_default: false }),
    ]

    expect(summarizeTaxRates(records)).toEqual({
      total: 3,
      active: 2,
      countries: 2,
      averageRate: 35 / 3,
      defaultConflicts: 1,
    })
  })
})
