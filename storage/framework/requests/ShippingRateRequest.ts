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
  weight_from: number
  weight_to: number
  rate: number
  shipping_zone_id: number
  shipping_method_id: number
  created_at?: string
  updated_at?: string
}
export class ShippingRateRequest extends Request<RequestDataShippingRate> implements ShippingRateRequestType {
  public id = 1
  public weight_from = 0
  public weight_to = 0
  public rate = 0
  public shipping_zone_id = 0
  public shipping_method_id = 0
  public created_at = ''
  public updated_at = ''
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
