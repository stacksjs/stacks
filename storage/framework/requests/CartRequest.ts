import type { schema } from '@stacksjs/validation'
import type { CartRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCart {
  id: number
  status: string[] | string
  total_items: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  expires_at: timestamp
  currency: string
  notes: string
  applied_coupon_id: string
  created_at?: string
  updated_at?: string
}
export class CartRequest extends Request<RequestDataCart> implements CartRequestType {
  public id = 1
  public status = []
  public total_items = 0
  public subtotal = 0
  public tax_amount = 0
  public discount_amount = 0
  public total = 0
  public expires_at = ''
  public currency = ''
  public notes = ''
  public applied_coupon_id = ''
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Cart', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const cartRequest = new CartRequest()
