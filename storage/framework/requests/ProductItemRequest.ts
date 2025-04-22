import type { schema } from '@stacksjs/validation'
import type { ProductItemRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProductItem {
  id: number
  name: string
  size: string
  color: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  sku: string
  custom_options: string
  created_at?: string
  updated_at?: string
}
export class ProductItemRequest extends Request<RequestDataProductItem> implements ProductItemRequestType {
  public id = 1
  public name = ''
  public size = ''
  public color = ''
  public price = 0
  public image_url = ''
  public is_available = false
  public inventory_count = 0
  public sku = ''
  public custom_options = ''
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ProductItem', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productItemRequest = new ProductItemRequest()
