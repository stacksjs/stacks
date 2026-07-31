import {
  commerceEnum,
  commerceIdentifier,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceStringList,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export interface ProductVariantRecord {
  id: string
  variant: string
  type: string
  description: string
  options: string[]
  status: 'active' | 'inactive' | 'draft'
  productId: string
  productName: string
  createdAt: string
}

export interface ProductVariantOption {
  id: string
  name: string
}

export interface ProductVariantSummary {
  total: number
  active: number
  draft: number
  linkedProducts: number
}

export function parseVariantOptions(input: unknown): string[] {
  return commerceStringList(input, 'ProductVariant', 'options')
}

export function productVariantOptions(products: any[]): ProductVariantOption[] {
  return products
    .map((product) => {
      const id = commerceIdentifier(commerceValue(product, 'id', 'uuid'), 'Product')
      return {
        id,
        name: commerceRequiredString(commerceValue(product, 'name'), `Product ${id}`, 'name'),
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function normalizeProductVariantRecord(
  record: any,
  productNames = new Map<string, string>(),
): ProductVariantRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'ProductVariant')
  const source = `ProductVariant ${id}`
  const productId = commerceOptionalIdentifier(
    commerceValue(record, 'product_id', 'productId'),
    source,
    'product_id',
  )
  const productName = productId ? productNames.get(productId) : undefined
  if (productId && !productName)
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  return {
    id,
    variant: commerceRequiredString(commerceValue(record, 'variant'), source, 'variant'),
    type: commerceRequiredString(commerceValue(record, 'type'), source, 'type'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    options: commerceStringList(commerceValue(record, 'options'), source, 'options'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'active',
      'inactive',
      'draft',
    ]),
    productId,
    productName: productName || '',
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function summarizeProductVariants(records: ProductVariantRecord[]): ProductVariantSummary {
  return {
    total: records.length,
    active: records.filter(record => record.status === 'active').length,
    draft: records.filter(record => record.status === 'draft').length,
    linkedProducts: new Set(records.map(record => record.productId).filter(Boolean)).size,
  }
}
