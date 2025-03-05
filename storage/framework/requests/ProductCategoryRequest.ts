import type { schema } from '@stacksjs/validation'
import type { ProductCategoryRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProductCategory {
  id: number
  name: string
  description: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: Date
  updated_at?: Date
}
export class ProductCategoryRequest extends Request<RequestDataProductCategory> implements ProductCategoryRequestType {
  public id = 1
  public name = ''
  public description = ''
  public image_url = ''
  public is_active = false
  public parent_category_id = ''
  public display_order = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ProductCategory', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productCategoryRequest = new ProductCategoryRequest()
