import type { schema } from '@stacksjs/validation'
import type { PaymentProductRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPaymentProduct {
  id: number
  name: string
  description: string
  key: string
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: string
  updated_at?: string
}
export class PaymentProductRequest extends Request<RequestDataPaymentProduct> implements PaymentProductRequestType {
  public id = 1
  public name = ''
  public description = ''
  public key = ''
  public unit_price = 0
  public status = ''
  public image = ''
  public provider_id = ''
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PaymentProduct', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const paymentProductRequest = new PaymentProductRequest()
