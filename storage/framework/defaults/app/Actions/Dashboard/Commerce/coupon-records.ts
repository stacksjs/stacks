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
  minOrderAmount: number
  maxDiscountAmount: number
  freeProductId: string
  usageLimit: number
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

function status(input: unknown): CouponStatus {
  const result = text(input)
  return result === 'Active' || result === 'Scheduled' ? result : 'Expired'
}

function discountType(input: unknown): CouponDiscountType {
  return text(input) === 'percentage' ? 'percentage' : 'fixed_amount'
}

export function normalizeCouponRecord(record: any): CouponRecord {
  return {
    id: text(value(record, 'id', 'uuid')),
    code: text(value(record, 'code')),
    description: text(value(record, 'description')),
    status: status(value(record, 'status')),
    isActive: boolean(value(record, 'is_active', 'isActive')),
    discountType: discountType(value(record, 'discount_type', 'discountType')),
    discountValue: Math.max(0, number(value(record, 'discount_value', 'discountValue'))),
    minOrderAmount: Math.max(0, number(value(record, 'min_order_amount', 'minOrderAmount'))),
    maxDiscountAmount: Math.max(0, number(value(record, 'max_discount_amount', 'maxDiscountAmount'))),
    freeProductId: text(value(record, 'free_product_id', 'freeProductId')),
    usageLimit: Math.max(0, number(value(record, 'usage_limit', 'usageLimit'))),
    usageCount: Math.max(0, number(value(record, 'usage_count', 'usageCount'))),
    startDate: text(value(record, 'start_date', 'startDate')),
    endDate: text(value(record, 'end_date', 'endDate')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
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
