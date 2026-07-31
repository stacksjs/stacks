import { describe, expect, it } from 'bun:test'
import {
  normalizeProductUnitRecord,
  productUnitOptions,
  summarizeProductUnits,
} from './product-unit-records'

function unit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    name: 'Kilogram',
    abbreviation: 'kg',
    type: 'Weight',
    description: null,
    is_default: false,
    product_id: null,
    created_at: '2026-07-29 10:00:00',
    ...overrides,
  }
}

describe('dashboard product unit records', () => {
  it('normalizes model columns and resolves linked products', () => {
    const record = normalizeProductUnitRecord(unit({
      description: 'Metric weight',
      is_default: 1,
      product_id: 7,
    }), new Map([['7', 'Coffee beans']]))

    expect(record).toEqual({
      id: '12',
      name: 'Kilogram',
      abbreviation: 'kg',
      type: 'Weight',
      description: 'Metric weight',
      isDefault: true,
      productId: '7',
      productName: 'Coffee beans',
      createdAt: '2026-07-29T10:00:00.000Z',
    })
  })

  it('rejects invalid values and missing Product relationships', () => {
    expect(() => normalizeProductUnitRecord(unit({
      is_default: 'yes',
    }))).toThrow('ProductUnit 12.is_default must be a boolean')
    expect(() => normalizeProductUnitRecord(unit({
      product_id: 9,
    }), new Map())).toThrow('ProductUnit 12.product_id references missing Product 9')
  })

  it('summarizes persisted units without double-counting linked products', () => {
    const productNames = new Map([['2', 'Coffee'], ['4', 'Milk']])
    const records = [
      normalizeProductUnitRecord(unit({ id: 1, name: 'Gram', is_default: true, product_id: 2 }), productNames),
      normalizeProductUnitRecord(unit({ id: 2, name: 'Kilogram', is_default: false, product_id: 2 }), productNames),
      normalizeProductUnitRecord(unit({ id: 3, name: 'Liter', type: 'Volume', is_default: true, product_id: 4 }), productNames),
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
      normalizeProductUnitRecord(unit({ id: 1, name: 'Liter', type: 'Volume', is_default: true })),
      normalizeProductUnitRecord(unit({ id: 2, name: 'Milliliter', type: 'Volume', is_default: true })),
      normalizeProductUnitRecord(unit({ id: 3, name: 'Gram', type: 'Weight', is_default: true })),
    ]

    expect(summarizeProductUnits(records).defaultConflicts).toBe(1)
  })

  it('builds stable, validated product options from model rows', () => {
    expect(productUnitOptions([
      { id: 2, name: 'Tea' },
      { id: 1, name: 'Coffee' },
    ])).toEqual([
      { id: '1', name: 'Coffee' },
      { id: '2', name: 'Tea' },
    ])
    expect(() => productUnitOptions([{ id: 3, name: '' }]))
      .toThrow('Product 3.name must be a non-empty string')
  })
})
