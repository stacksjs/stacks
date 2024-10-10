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
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export class SubscriberEmailRequest extends Request<RequestDataSubscriberEmail> implements SubscriberEmailRequestType {
  public id = 1
  public email = ''
  public created_at = new Date()
  public updated_at = new Date()

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

export const request = new SubscriberEmailRequest()
