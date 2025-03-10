import type { schema } from '@stacksjs/validation'
import type { ProductRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProduct {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  is_available: boolean
  inventory_count: number
  category_id: string
  preparation_time: number
  allergens: string
  nutritional_info: string
  manufacturer_id: number
  product_category_id: number
  created_at?: Date
  updated_at?: Date
}
export class ProductRequest extends Request<RequestDataProduct> implements ProductRequestType {
  public id = 1
  public name = ''
  public description = ''
  public price = 0
  public image_url = ''
  public is_available = false
  public inventory_count = 0
  public category_id = ''
  public preparation_time = 0
  public allergens = ''
  public nutritional_info = ''
  public manufacturer_id = 0
  public product_category_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Product', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productRequest = new ProductRequest()
