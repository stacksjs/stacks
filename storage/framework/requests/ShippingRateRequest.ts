import type { schema } from '@stacksjs/validation'
import type { ShippingRateRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataShippingRate {
  id: number
  method: string
  zone: string
  weight_from: number
  weight_to: number
  rate: number
  created_at?: Date
  updated_at?: Date
}
export class ShippingRateRequest extends Request<RequestDataShippingRate> implements ShippingRateRequestType {
  public id = 1
  public method = ''
  public zone = ''
  public weight_from = 0
  public weight_to = 0
  public rate = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ShippingRate', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const shippingRateRequest = new ShippingRateRequest()
