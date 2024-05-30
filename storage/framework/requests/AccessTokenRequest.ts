import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface AccessTokenRequestType extends RequestInstance{
      validate(params: any): void
    }

export class AccessTokenRequest extends Request implements AccessTokenRequestType  {
      
      public validate(params: any): void {
        validateField('AccessToken', this.all())
      }
    }