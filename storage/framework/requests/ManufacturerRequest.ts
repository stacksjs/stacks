import type { schema } from '@stacksjs/validation'
import type { ManufacturerRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataManufacturer {
  id: number
  manufacturer: string
  description: string
  country: string
  featured: boolean
  created_at?: Date
  updated_at?: Date
}
export class ManufacturerRequest extends Request<RequestDataManufacturer> implements ManufacturerRequestType {
  public id = 1
  public manufacturer = ''
  public description = ''
  public country = ''
  public featured = false
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Manufacturer', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const manufacturerRequest = new ManufacturerRequest()
