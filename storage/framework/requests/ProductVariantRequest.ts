import type { schema } from '@stacksjs/validation'
import type { ProductVariantRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProductVariant {
  id: number
  variant: string
  type: string
  description: string
  options: string
  status: string[] | string
  product_id: number
  created_at?: Date
  updated_at?: Date
}
export class ProductVariantRequest extends Request<RequestDataProductVariant> implements ProductVariantRequestType {
  public id = 1
  public variant = ''
  public type = ''
  public description = ''
  public options = ''
  public status = []
  public product_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ProductVariant', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productVariantRequest = new ProductVariantRequest()
