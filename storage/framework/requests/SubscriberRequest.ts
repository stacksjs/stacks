import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { SubscriberRequestType } from '../types/requests'

export class SubscriberRequest extends Request implements SubscriberRequestType {
      public id = 1
public subscribed = false
public user_id = 0
public created_at = ''
      public updated_at = ''
      public deleted_at = ''
      
      public async validate(): Promise<void> {
        await validateField('Subscriber', this.all())
      }
    }
    
    export const subscriberRequest = new SubscriberRequest()
    