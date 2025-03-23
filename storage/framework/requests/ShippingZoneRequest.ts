import type { schema } from '@stacksjs/validation'
import type { ShippingZoneRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataShippingZone {
  id: number
  name: string
  countries: string
  regions: string
  postal_codes: string
  status: string[]
  shipping_method_id: number
  created_at?: Date
  updated_at?: Date
}
export class ShippingZoneRequest extends Request<RequestDataShippingZone> implements ShippingZoneRequestType {
  public id = 1
  public name = ''
  public countries = ''
  public regions = ''
  public postal_codes = ''
  public status = ''
  public shipping_method_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ShippingZone', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const shippingZoneRequest = new ShippingZoneRequest()
