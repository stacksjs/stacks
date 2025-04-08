import type { schema } from '@stacksjs/validation'
import type { ProductUnitRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProductUnit {
  id: number
  name: string
  abbreviation: string
  type: string
  description: string
  is_default: boolean
  product_id: number
  created_at?: string
  updated_at?: string
}
export class ProductUnitRequest extends Request<RequestDataProductUnit> implements ProductUnitRequestType {
  public id = 1
  public name = ''
  public abbreviation = ''
  public type = ''
  public description = ''
  public is_default = false
  public product_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ProductUnit', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productUnitRequest = new ProductUnitRequest()
