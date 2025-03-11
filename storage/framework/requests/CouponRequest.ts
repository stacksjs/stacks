import type { schema } from '@stacksjs/validation'
import type { CouponRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCoupon {
  id: number
  code: string
  description: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  free_product_id: string
  is_active: boolean
  usage_limit: number
  usage_count: number
  start_date: date
  end_date: date
  applicable_products: string
  applicable_categories: string
  created_at?: Date
  updated_at?: Date
}
export class CouponRequest extends Request<RequestDataCoupon> implements CouponRequestType {
  public id = 1
  public code = ''
  public description = ''
  public discount_type = ''
  public discount_value = 0
  public min_order_amount = 0
  public max_discount_amount = 0
  public free_product_id = ''
  public is_active = false
  public usage_limit = 0
  public usage_count = 0
  public start_date = ''
  public end_date = ''
  public applicable_products = ''
  public applicable_categories = ''
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Coupon', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const couponRequest = new CouponRequest()
