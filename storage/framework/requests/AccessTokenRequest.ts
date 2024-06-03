import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface AccessTokenRequestType extends RequestInstance{
      validate(): void
       name: string
      token: string
      plainTextToken: string
      abilities: enum
     
    }

export class AccessTokenRequest extends Request implements AccessTokenRequestType  {
      public name = ''
public token = ''
public plainTextToken = ''
public abilities = ''

      public validate(): void {
        validateField('AccessToken', this.all())
      }
    }
    
    export const accessTokenRequest = new AccessTokenRequest()
    