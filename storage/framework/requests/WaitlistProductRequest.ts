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
  notified_at: unix
  purchased_at: unix
  cancelled_at: unix
  customer_id: number
  product_id: number
  created_at?: string
  updated_at?: string
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
  public notified_at = ''
  public purchased_at = ''
  public cancelled_at = ''
  public customer_id = 0
  public product_id = 0
  public created_at = ''
  public updated_at = ''
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
