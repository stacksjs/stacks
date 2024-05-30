import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface SubscriberEmailRequestType extends RequestInstance{
      validate(params: any): void
    }

export class SubscriberEmailRequest extends Request implements SubscriberEmailRequestType  {
      
      public validate(params: any): void {
        validateField('SubscriberEmail', this.all())
      }
    }