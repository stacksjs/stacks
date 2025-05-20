import type { schema } from '@stacksjs/validation'
import type { PaymentTransactionRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPaymentTransaction {
  id: number
  name: string
  description: string
  amount: number
  type: string
  provider_id: string
  payment_method_id: number
  created_at?: string
  updated_at?: string
}
export class PaymentTransactionRequest extends Request<RequestDataPaymentTransaction> implements PaymentTransactionRequestType {
  public id = 1
  public name = ''
  public description = ''
  public amount = 0
  public type = ''
  public provider_id = ''
  public payment_method_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PaymentTransaction', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const paymentTransactionRequest = new PaymentTransactionRequest()
