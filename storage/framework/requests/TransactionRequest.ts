import type { schema } from '@stacksjs/validation'
import type { TransactionRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataTransaction {
  id: number
  order_id: string
  amount: number
  status: string
  payment_method: string
  payment_details: string // Store as JSON string
  transaction_reference: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  created_at?: Date
  updated_at?: Date
}
export class TransactionRequest extends Request<RequestDataTransaction> implements TransactionRequestType {
  public id = 1
  public order_id = ''
  public amount = 0
  public status = ''
  public payment_method = ''
  public payment_details = ''
  public transaction_reference = ''
  public loyalty_points_earned = 0
  public loyalty_points_redeemed = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Transaction', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const transactionRequest = new TransactionRequest()
