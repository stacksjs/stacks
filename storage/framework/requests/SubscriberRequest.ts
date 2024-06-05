import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface SubscriberRequestType extends RequestInstance{
      validate(): void
       subscribed: boolean
     
    }

export class SubscriberRequest extends Request implements SubscriberRequestType  {
      public subscribed = false

      public async validate(): Promise<void> {
        await validateField('Subscriber', this.all())
      }
    }
    
    export const subscriberRequest = new SubscriberRequest()
    