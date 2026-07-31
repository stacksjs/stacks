import {
  commerceBoolean,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalDate,
  commerceOptionalIdentifier,
  commerceOptionalNumber,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export type CouponStatus = 'Active' | 'Scheduled' | 'Expired'
export type CouponDiscountType = 'fixed_amount' | 'percentage'

export interface CouponRecord {
  id: string
  code: string
  description: string
  status: CouponStatus
  isActive: boolean
  discountType: CouponDiscountType
  discountValue: number
  minOrderAmount: number | null
  maxDiscountAmount: number | null
  freeProductId: string
  productId: string
  usageLimit: number | null
  usageCount: number
  startDate: string
  endDate: string
  createdAt: string
}

export interface CouponSummary {
  total: number
  enabled: number
  scheduled: number
  expired: number
  redemptions: number
}

export function normalizeCouponRecord(
  record: any,
  productIds = new Set<string>(),
): CouponRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Coupon')
  const source = `Coupon ${id}`
  const productId = commerceOptionalIdentifier(
    commerceValue(record, 'product_id', 'productId'),
    source,
    'product_id',
  )
  if (productId && !productIds.has(productId))
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  const discountType = commerceEnum(
    commerceValue(record, 'discount_type', 'discountType'),
    source,
    'discount_type',
    ['fixed_amount', 'percentage'],
  )
  const discountValue = commerceNumber(
    commerceValue(record, 'discount_value', 'discountValue'),
    source,
    'discount_value',
    { min: 0.01 },
  )
  if (discountType === 'percentage' && discountValue > 100)
    throw new TypeError(`${source}.discount_value must be at most 100 for percentage coupons.`)

  return {
    id,
    code: commerceRequiredString(commerceValue(record, 'code'), source, 'code'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'Active',
      'Scheduled',
      'Expired',
    ]),
    isActive: commerceBoolean(
      commerceValue(record, 'is_active', 'isActive'),
      source,
      'is_active',
    ),
    discountType,
    discountValue,
    minOrderAmount: commerceOptionalNumber(
      commerceValue(record, 'min_order_amount', 'minOrderAmount'),
      source,
      'min_order_amount',
      { min: 0 },
    ),
    maxDiscountAmount: commerceOptionalNumber(
      commerceValue(record, 'max_discount_amount', 'maxDiscountAmount'),
      source,
      'max_discount_amount',
      { min: 0 },
    ),
    freeProductId: commerceOptionalString(
      commerceValue(record, 'free_product_id', 'freeProductId'),
      source,
      'free_product_id',
    ),
    productId,
    usageLimit: commerceOptionalNumber(
      commerceValue(record, 'usage_limit', 'usageLimit'),
      source,
      'usage_limit',
      { min: 1, integer: true },
    ),
    usageCount: commerceNumber(
      commerceValue(record, 'usage_count', 'usageCount'),
      source,
      'usage_count',
      { min: 0, integer: true },
    ),
    startDate: commerceOptionalDate(
      commerceValue(record, 'start_date', 'startDate'),
      source,
      'start_date',
    ),
    endDate: commerceOptionalDate(
      commerceValue(record, 'end_date', 'endDate'),
      source,
      'end_date',
    ),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function summarizeCoupons(records: CouponRecord[]): CouponSummary {
  return {
    total: records.length,
    enabled: records.filter(record => record.isActive).length,
    scheduled: records.filter(record => record.status === 'Scheduled').length,
    expired: records.filter(record => record.status === 'Expired').length,
    redemptions: records.reduce((sum, record) => sum + record.usageCount, 0),
  }
}
