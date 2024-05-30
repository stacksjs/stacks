import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface UserRequestType extends RequestInstance{
      validate(params: any): void
    }

export class UserRequest extends Request implements UserRequestType  {
      
      public validate(params: any): void {
        validateField('User', this.all())
      }
    }
    
    export const userRequest = new UserRequest()
    