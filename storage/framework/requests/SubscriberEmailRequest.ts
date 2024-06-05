import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface SubscriberEmailRequestType extends RequestInstance{
      validate(): void
       email: string
     
    }

export class SubscriberEmailRequest extends Request implements SubscriberEmailRequestType  {
      public email = ''

      public async validate(): Promise<void> {
        await validateField('SubscriberEmail', this.all())
      }
    }
    
    export const subscriberEmailRequest = new SubscriberEmailRequest()
    