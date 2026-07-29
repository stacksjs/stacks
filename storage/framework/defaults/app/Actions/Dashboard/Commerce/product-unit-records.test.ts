import { describe, expect, it } from 'bun:test'
import {
  normalizeProductUnitRecord,
  productUnitOptions,
  summarizeProductUnits,
} from './product-unit-records'

describe('dashboard product unit records', () => {
  it('normalizes model columns and resolves linked products', () => {
    const record = normalizeProductUnitRecord({
      id: 12,
      name: 'Kilogram',
      abbreviation: 'kg',
      type: 'Weight',
      description: 'Metric weight',
      is_default: 1,
      product_id: 7,
      created_at: '2026-07-29 10:00:00',
    }, new Map([['7', 'Coffee beans']]))

    expect(record).toEqual({
      id: '12',
      name: 'Kilogram',
      abbreviation: 'kg',
      type: 'Weight',
      description: 'Metric weight',
      isDefault: true,
      productId: '7',
      productName: 'Coffee beans',
      createdAt: '2026-07-29 10:00:00',
    })
  })

  it('summarizes persisted units without double-counting linked products', () => {
    const records = [
      normalizeProductUnitRecord({ id: 1, name: 'Gram', type: 'Weight', is_default: true, product_id: 2 }),
      normalizeProductUnitRecord({ id: 2, name: 'Kilogram', type: 'Weight', is_default: false, product_id: 2 }),
      normalizeProductUnitRecord({ id: 3, name: 'Liter', type: 'Volume', is_default: true, product_id: 4 }),
    ]

    expect(summarizeProductUnits(records)).toEqual({
      total: 3,
      defaults: 2,
      types: 2,
      linkedProducts: 2,
      defaultConflicts: 0,
    })
  })

  it('reports unit types with competing defaults', () => {
    const records = [
      normalizeProductUnitRecord({ id: 1, name: 'Liter', type: 'Volume', is_default: true }),
      normalizeProductUnitRecord({ id: 2, name: 'Milliliter', type: 'Volume', is_default: true }),
      normalizeProductUnitRecord({ id: 3, name: 'Gram', type: 'Weight', is_default: true }),
    ]

    expect(summarizeProductUnits(records).defaultConflicts).toBe(1)
  })

  it('builds stable product options from model rows', () => {
    expect(productUnitOptions([
      { id: 2, name: 'Tea' },
      { id: 1, name: 'Coffee' },
      { id: 3, name: '' },
    ])).toEqual([
      { id: '1', name: 'Coffee' },
      { id: '2', name: 'Tea' },
    ])
  })
})
