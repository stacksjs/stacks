import type { schema } from '@stacksjs/validation'
import type { PaymentRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPayment {
  id: number
  amount: number
  method: string
  status: string
  currency: string
  reference_number: string
  card_last_four: string
  card_brand: string
  billing_email: string
  transaction_id: string
  payment_provider: string
  refund_amount: number
  notes: string
  customer_id: number
  order_id: number
  created_at?: string
  updated_at?: string
}
export class PaymentRequest extends Request<RequestDataPayment> implements PaymentRequestType {
  public id = 1
  public amount = 0
  public method = ''
  public status = ''
  public currency = ''
  public reference_number = ''
  public card_last_four = ''
  public card_brand = ''
  public billing_email = ''
  public transaction_id = ''
  public payment_provider = ''
  public refund_amount = 0
  public notes = ''
  public customer_id = 0
  public order_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Payment', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const paymentRequest = new PaymentRequest()
