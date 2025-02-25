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
  user_id: number
  payment_method_id: number
  created_at?: Date
  updated_at?: Date
}
export class PaymentTransactionRequest extends Request<RequestDataPaymentTransaction> implements PaymentTransactionRequestType {
  public id = 1
  public name = ''
  public description = ''
  public amount = 0
  public type = ''
  public provider_id = ''
  public user_id = 0
  public payment_method_id = 0
  public created_at = new Date()
  public updated_at = new Date()
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

export const paymenttransactionRequest = new PaymentTransactionRequest()
