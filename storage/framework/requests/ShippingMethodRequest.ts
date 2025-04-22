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
  status: string[] | string
  created_at?: string
  updated_at?: string
}
export class ShippingMethodRequest extends Request<RequestDataShippingMethod> implements ShippingMethodRequestType {
  public id = 1
  public name = ''
  public description = ''
  public base_rate = 0
  public free_shipping = 0
  public status = []
  public created_at = ''
  public updated_at = ''
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
