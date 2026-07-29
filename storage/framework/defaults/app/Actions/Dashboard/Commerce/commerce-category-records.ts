export interface CommerceCategoryRecord {
  id: string
  name: string
  description: string
  slug: string
  imageUrl: string
  isActive: boolean
  parentCategoryId: string
  displayOrder: number
  createdAt: string
}

export interface CommerceCategorySummary {
  total: number
  active: number
  roots: number
  children: number
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

function number(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) ? result : 0
}

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

export function normalizeCommerceCategoryRecord(record: any): CommerceCategoryRecord {
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    description: text(value(record, 'description')),
    slug: text(value(record, 'slug')),
    imageUrl: text(value(record, 'image_url', 'imageUrl')),
    isActive: boolean(value(record, 'is_active', 'isActive')),
    parentCategoryId: text(value(record, 'parent_category_id', 'parentCategoryId')),
    displayOrder: Math.max(0, number(value(record, 'display_order', 'displayOrder'))),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeCommerceCategories(records: CommerceCategoryRecord[]): CommerceCategorySummary {
  const roots = records.filter(record => !record.parentCategoryId).length
  return {
    total: records.length,
    active: records.filter(record => record.isActive).length,
    roots,
    children: records.length - roots,
  }
}
