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
  created_at?: string
  updated_at?: string
}
export class ManufacturerRequest extends Request<RequestDataManufacturer> implements ManufacturerRequestType {
  public id = 1
  public manufacturer = ''
  public description = ''
  public country = ''
  public featured = false
  public created_at = ''
  public updated_at = ''
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
