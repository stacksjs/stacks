import { describe, expect, test } from 'bun:test'
import {
  manufacturerProductCounts,
  normalizeManufacturerRecord,
  summarizeManufacturers,
} from './manufacturer-records'

describe('dashboard manufacturer records', () => {
  test('normalizes model columns and counts linked products', () => {
    const counts = manufacturerProductCounts([
      { manufacturer_id: 4 },
      { manufacturerId: '4' },
      { manufacturer_id: 8 },
      { manufacturer_id: null },
    ])
    const record = normalizeManufacturerRecord({
      id: 4,
      manufacturer: 'Native Systems',
      description: 'Recorded manufacturer',
      country: 'Canada',
      featured: 1,
      created_at: '2026-07-29 10:00:00',
    }, counts)

    expect(record).toEqual({
      id: '4',
      name: 'Native Systems',
      description: 'Recorded manufacturer',
      country: 'Canada',
      featured: true,
      productCount: 2,
      createdAt: '2026-07-29 10:00:00',
    })
  })

  test('summarizes persisted manufacturers without invented fields', () => {
    expect(summarizeManufacturers([
      { id: '1', name: 'One', description: '', country: 'Canada', featured: true, productCount: 2, createdAt: '' },
      { id: '2', name: 'Two', description: '', country: 'Canada', featured: false, productCount: 0, createdAt: '' },
      { id: '3', name: 'Three', description: '', country: 'Japan', featured: true, productCount: 1, createdAt: '' },
    ])).toEqual({
      total: 3,
      featured: 2,
      countries: 2,
      linkedProducts: 3,
    })
  })
})
