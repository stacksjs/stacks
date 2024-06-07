import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { SubscriberRequestType } from '../types/requests'

export class SubscriberRequest extends Request implements SubscriberRequestType {
      public id = 1
public subscribed = false
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('Subscriber', this.all())
      }
    }
    
    export const subscriberRequest = new SubscriberRequest()
    