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
  description: number
  key: number
  unit_price: number
  status: string
  image: string
  provider_id: string
  created_at?: Date
  updated_at?: Date
}
export class PaymentProductRequest extends Request<RequestDataPaymentProduct> implements PaymentProductRequestType {
  public id = 1
  public name = ''
  public description = 0
  public key = 0
  public unit_price = 0
  public status = ''
  public image = ''
  public provider_id = ''
  public created_at = new Date()
  public updated_at = new Date()
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

export const paymentproductRequest = new PaymentProductRequest()
