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
  status: string[] | string
  is_active: boolean
  discount_type: string[] | string
  discount_value: number
  min_order_amount: number
  max_discount_amount: number
  free_product_id: string
  usage_limit: number
  usage_count: number
  start_date: date
  end_date: date
  product_id: number
  created_at?: string
  updated_at?: string
}
export class CouponRequest extends Request<RequestDataCoupon> implements CouponRequestType {
  public id = 1
  public code = ''
  public description = ''
  public status = []
  public is_active = false
  public discount_type = []
  public discount_value = 0
  public min_order_amount = 0
  public max_discount_amount = 0
  public free_product_id = ''
  public usage_limit = 0
  public usage_count = 0
  public start_date = ''
  public end_date = ''
  public product_id = 0
  public created_at = ''
  public updated_at = ''
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
