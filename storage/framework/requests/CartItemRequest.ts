import type { schema } from '@stacksjs/validation'
import type { CartItemRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCartItem {
  id: number
  quantity: number
  unit_price: number
  total_price: number
  tax_rate: number
  tax_amount: number
  discount_percentage: number
  discount_amount: number
  product_name: string
  product_sku: string
  product_image: string
  notes: string
  cart_id: number
  created_at?: string
  updated_at?: string
}
export class CartItemRequest extends Request<RequestDataCartItem> implements CartItemRequestType {
  public id = 1
  public quantity = 0
  public unit_price = 0
  public total_price = 0
  public tax_rate = 0
  public tax_amount = 0
  public discount_percentage = 0
  public discount_amount = 0
  public product_name = ''
  public product_sku = ''
  public product_image = ''
  public notes = ''
  public cart_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('CartItem', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const cartItemRequest = new CartItemRequest()
