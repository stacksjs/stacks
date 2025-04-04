import type { schema } from '@stacksjs/validation'
import type { WaitlistProductRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataWaitlistProduct {
  id: number
  name: string
  email: string
  phone: string
  quantity: number
  notification_preference: string[] | string
  source: string
  notes: string
  status: string[] | string
  notified_at: number
  purchased_at: number
  cancelled_at: number
  customer_id: number
  product_id: number
  created_at?: Date
  updated_at?: Date
}
export class WaitlistProductRequest extends Request<RequestDataWaitlistProduct> implements WaitlistProductRequestType {
  public id = 1
  public name = ''
  public email = ''
  public phone = ''
  public quantity = 0
  public notification_preference = []
  public source = ''
  public notes = ''
  public status = []
  public notified_at = 0
  public purchased_at = 0
  public cancelled_at = 0
  public customer_id = 0
  public product_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('WaitlistProduct', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const waitlistProductRequest = new WaitlistProductRequest()
