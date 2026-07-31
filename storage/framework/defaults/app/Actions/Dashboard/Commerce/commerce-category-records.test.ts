import { describe, expect, test } from 'bun:test'
import { normalizeCommerceCategoryRecord, summarizeCommerceCategories } from './commerce-category-records'

describe('dashboard commerce category records', () => {
  test('normalizes model columns without fabricating image data', () => {
    expect(normalizeCommerceCategoryRecord({
      id: 7,
      name: 'Hardware',
      description: 'Native tools',
      slug: 'hardware',
      image_url: '/categories/hardware.jpg',
      is_active: 1,
      parent_category_id: 2,
      display_order: 8,
      created_at: '2026-07-29 12:00:00',
    })).toMatchObject({
      id: '7',
      name: 'Hardware',
      description: 'Native tools',
      slug: 'hardware',
      imageUrl: '/categories/hardware.jpg',
      isActive: true,
      parentCategoryId: '2',
      displayOrder: 8,
    })
  })

  test('summarizes persisted availability and hierarchy', () => {
    const records = [
      normalizeCommerceCategoryRecord({
        id: 1,
        name: 'Root',
        slug: 'root',
        isActive: true,
        displayOrder: 1,
        createdAt: '2026-07-29 12:00:00',
      }),
      normalizeCommerceCategoryRecord({
        id: 2,
        name: 'Child',
        slug: 'child',
        isActive: true,
        parentCategoryId: 1,
        displayOrder: 2,
        createdAt: '2026-07-29 12:00:00',
      }),
      normalizeCommerceCategoryRecord({
        id: 3,
        name: 'Disabled',
        slug: 'disabled',
        isActive: false,
        displayOrder: 3,
        createdAt: '2026-07-29 12:00:00',
      }),
    ]

    expect(summarizeCommerceCategories(records)).toEqual({
      total: 3,
      active: 2,
      roots: 2,
      children: 1,
    })
  })

  test('rejects missing or coercive stored category values', () => {
    const base = {
      id: 1,
      name: 'Hardware',
      slug: 'hardware',
      is_active: true,
      display_order: 1,
      created_at: '2026-07-29 12:00:00',
    }
    expect(() => normalizeCommerceCategoryRecord({ ...base, name: '' }))
      .toThrow('Category 1.name must be a non-empty string')
    expect(() => normalizeCommerceCategoryRecord({ ...base, display_order: 'first' }))
      .toThrow('Category 1.display_order must be a finite number')
    expect(() => normalizeCommerceCategoryRecord({ ...base, is_active: null }))
      .toThrow('Category 1.is_active must be a boolean')
  })
})
