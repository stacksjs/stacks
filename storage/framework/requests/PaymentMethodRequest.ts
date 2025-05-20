import type { schema } from '@stacksjs/validation'
import type { PaymentMethodRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPaymentMethod {
  id: number
  type: string
  last_four: number
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  provider_id: string
  created_at?: string
  updated_at?: string
}
export class PaymentMethodRequest extends Request<RequestDataPaymentMethod> implements PaymentMethodRequestType {
  public id = 1
  public type = ''
  public last_four = 0
  public brand = ''
  public exp_month = 0
  public exp_year = 0
  public is_default = false
  public provider_id = ''
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PaymentMethod', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const paymentMethodRequest = new PaymentMethodRequest()
