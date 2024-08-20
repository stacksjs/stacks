import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { SubscriberEmailRequestType } from '../types/requests'

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataSubscriberEmail {
  id?: number
  email: string
  created_at?: string
  updated_at?: string
  deleted_at?: string
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
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new SubscriberEmailRequest()
