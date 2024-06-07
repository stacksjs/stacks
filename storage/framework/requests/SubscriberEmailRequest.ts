import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { SubscriberEmailRequestType } from '../types/requests'

export class SubscriberEmailRequest extends Request implements SubscriberEmailRequestType {
      public id = 1
public email = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('SubscriberEmail', this.all())
      }
    }
    
    export const subscriberEmailRequest = new SubscriberEmailRequest()
    