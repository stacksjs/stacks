import type { schema } from '@stacksjs/validation'
import type { ShippingMethodRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataShippingMethod {
  id: number
  name: string
  description: string
  base_rate: number
  free_shipping: number
  zones: string
  status: string[]
  created_at?: Date
  updated_at?: Date
}
export class ShippingMethodRequest extends Request<RequestDataShippingMethod> implements ShippingMethodRequestType {
  public id = 1
  public name = ''
  public description = ''
  public base_rate = 0
  public free_shipping = 0
  public zones = ''
  public status = ''
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ShippingMethod', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const shippingMethodRequest = new ShippingMethodRequest()
