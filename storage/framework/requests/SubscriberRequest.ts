import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { SubscriberRequestType } from '../types/requests'

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
interface RequestDataSubscriber {
  id?: number
  subscribed: boolean
  user_id: number
  created_at?: string
  updated_at?: string
  deleted_at?: string
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
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new SubscriberRequest()
