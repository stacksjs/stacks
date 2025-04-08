import type { schema } from '@stacksjs/validation'
import type { SubscriberRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataSubscriber {
  id: number
  subscribed: boolean
  user_id: number
  created_at?: string
  updated_at?: string
}
export class SubscriberRequest extends Request<RequestDataSubscriber> implements SubscriberRequestType {
  public id = 1
  public subscribed = false
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Subscriber', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const subscriberRequest = new SubscriberRequest()
