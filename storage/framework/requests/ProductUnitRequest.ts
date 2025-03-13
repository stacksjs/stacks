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
  created_at?: Date
  updated_at?: Date
}
export class ProductUnitRequest extends Request<RequestDataProductUnit> implements ProductUnitRequestType {
  public id = 1
  public name = ''
  public abbreviation = ''
  public type = ''
  public description = ''
  public is_default = false
  public created_at = new Date()
  public updated_at = new Date()
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
