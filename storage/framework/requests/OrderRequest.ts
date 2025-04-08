import type { schema } from '@stacksjs/validation'
import type { OrderRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataOrder {
  id: number
  status: string
  total_amount: number
  tax_amount: number
  discount_amount: number
  delivery_fee: number
  tip_amount: number
  order_type: string
  delivery_address: string
  special_instructions: string
  estimated_delivery_time: string
  applied_coupon_id: string
  customer_id: number
  gift_card_id: number
  coupon_id: number
  created_at?: string
  updated_at?: string
}
export class OrderRequest extends Request<RequestDataOrder> implements OrderRequestType {
  public id = 1
  public status = ''
  public total_amount = 0
  public tax_amount = 0
  public discount_amount = 0
  public delivery_fee = 0
  public tip_amount = 0
  public order_type = ''
  public delivery_address = ''
  public special_instructions = ''
  public estimated_delivery_time = ''
  public applied_coupon_id = ''
  public customer_id = 0
  public gift_card_id = 0
  public coupon_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Order', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const orderRequest = new OrderRequest()
