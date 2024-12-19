import type { SubscriptionRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataSubscription {
  id: number
  type: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: string
  ends_at: string
  last_used_at: string
  user_id: number
  created_at?: Date
  updated_at?: Date
}
export class SubscriptionRequest extends Request<RequestDataSubscription> implements SubscriptionRequestType {
  public id = 1
  public type = ''
  public provider_id = ''
  public provider_status = ''
  public unit_price = 0
  public provider_type = ''
  public provider_price_id = ''
  public quantity = 0
  public trial_ends_at = ''
  public ends_at = ''
  public last_used_at = ''
  public user_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Subscription', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new SubscriptionRequest()
