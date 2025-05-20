import type { schema } from '@stacksjs/validation'
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
  plan: string
  provider_id: string
  provider_status: string
  unit_price: number
  provider_type: string
  provider_price_id: string
  quantity: number
  trial_ends_at: timestamp
  ends_at: timestamp
  last_used_at: timestamp
  created_at?: string
  updated_at?: string
}
export class SubscriptionRequest extends Request<RequestDataSubscription> implements SubscriptionRequestType {
  public id = 1
  public type = ''
  public plan = ''
  public provider_id = ''
  public provider_status = ''
  public unit_price = 0
  public provider_type = ''
  public provider_price_id = ''
  public quantity = 0
  public trial_ends_at = ''
  public ends_at = ''
  public last_used_at = ''
  public created_at = ''
  public updated_at = ''
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

export const subscriptionRequest = new SubscriptionRequest()
