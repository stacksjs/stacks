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
      normalizeCommerceCategoryRecord({ id: 1, name: 'Root', isActive: true }),
      normalizeCommerceCategoryRecord({ id: 2, name: 'Child', isActive: true, parentCategoryId: 1 }),
      normalizeCommerceCategoryRecord({ id: 3, name: 'Disabled', isActive: false }),
    ]

    expect(summarizeCommerceCategories(records)).toEqual({
      total: 3,
      active: 2,
      roots: 2,
      children: 1,
    })
  })
})
