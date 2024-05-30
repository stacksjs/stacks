import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface SubscriberRequestType extends RequestInstance{
      validate(params: any): void
    }

export class SubscriberRequest extends Request implements SubscriberRequestType  {
      
      public validate(params: any): void {
        validateField('Subscriber', this.all())
      }
    }
    
    export const subscriberRequest = new SubscriberRequest()
    