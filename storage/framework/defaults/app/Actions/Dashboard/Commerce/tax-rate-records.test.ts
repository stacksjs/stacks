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
      createdAt: '2026-07-29T10:00:00.000Z',
    })
  })

  it('rejects incomplete and coercive TaxRate columns', () => {
    expect(() => normalizeTaxRateRecord({
      id: 4,
      name: 'Standard VAT',
      rate: 'not-a-rate',
      type: 'VAT',
      country: 'France',
      region: 'Europe',
      status: 'active',
      is_default: false,
      created_at: '2026-07-29 10:00:00',
    })).toThrow('TaxRate 4.rate must be a finite number')

    expect(() => normalizeTaxRateRecord({
      id: 5,
      name: 'Legacy tax',
      rate: 20,
      type: 'VAT',
      country: 'France',
      region: 'Atlantis',
      status: 'active',
      is_default: false,
      created_at: '2026-07-29 10:00:00',
    })).toThrow('TaxRate 5.region must be North America')
  })

  it('summarizes rates and reports competing defaults', () => {
    const records = [
      normalizeTaxRateRecord({
        id: 1,
        name: 'VAT',
        rate: 20,
        type: 'VAT',
        country: 'France',
        region: 'Europe',
        status: 'active',
        is_default: true,
        created_at: '2026-07-29 10:00:00',
      }),
      normalizeTaxRateRecord({
        id: 2,
        name: 'GST',
        rate: 10,
        type: 'GST',
        country: 'Australia',
        region: 'Oceania',
        status: 'inactive',
        is_default: true,
        created_at: '2026-07-29 10:00:00',
      }),
      normalizeTaxRateRecord({
        id: 3,
        name: 'Reduced VAT',
        rate: 5,
        type: 'VAT',
        country: 'France',
        region: 'Europe',
        status: 'active',
        is_default: false,
        created_at: '2026-07-29 10:00:00',
      }),
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
