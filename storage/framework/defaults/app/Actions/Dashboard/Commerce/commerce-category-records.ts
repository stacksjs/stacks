import {
  commerceBoolean,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

export function normalizeCommerceCategoryRecord(record: any): CommerceCategoryRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Category')
  const source = `Category ${id}`
  const parentValue = commerceValue(record, 'parent_category_id', 'parentCategoryId')
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    slug: commerceRequiredString(commerceValue(record, 'slug'), source, 'slug'),
    imageUrl: commerceOptionalString(commerceValue(record, 'image_url', 'imageUrl'), source, 'image_url'),
    isActive: commerceBoolean(commerceValue(record, 'is_active', 'isActive'), source, 'is_active'),
    parentCategoryId: parentValue === undefined || parentValue === null || parentValue === ''
      ? ''
      : commerceIdentifier(parentValue, source, 'parent_category_id'),
    displayOrder: commerceNumber(
      commerceValue(record, 'display_order', 'displayOrder'),
      source,
      'display_order',
      { integer: true },
    ),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
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
