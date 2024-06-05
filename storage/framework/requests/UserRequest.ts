import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface UserRequestType extends RequestInstance{
      validate(): void
       name: string
      email: string
      jobTitle: string
      password: string
     
    }

export class UserRequest extends Request implements UserRequestType  {
      public name = ''
public email = ''
public jobTitle = ''
public password = ''

      public async validate(): Promise<void> {
        await validateField('User', this.all())
      }
    }
    
    export const userRequest = new UserRequest()
    