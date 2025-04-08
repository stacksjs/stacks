import type { schema } from '@stacksjs/validation'
import type { SubscriberEmailRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataSubscriberEmail {
  id: number
  email: string
  deleted_at?: string
  created_at?: string
  updated_at?: string
}
export class SubscriberEmailRequest extends Request<RequestDataSubscriberEmail> implements SubscriberEmailRequestType {
  public id = 1
  public email = ''
  public created_at = ''
  public updated_at = ''

  public deleted_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('SubscriberEmail', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const subscriberEmailRequest = new SubscriberEmailRequest()
