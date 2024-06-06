import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface SubscriberEmailRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'email'): number | string | null
       id: number
 email: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class SubscriberEmailRequest extends Request implements SubscriberEmailRequestType  {
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
    