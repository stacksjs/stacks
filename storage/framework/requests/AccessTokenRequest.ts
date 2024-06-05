import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface AccessTokenRequestType extends RequestInstance{
      validate(): void
       name: string
      token: string
      plainTextToken: string
      abilities: string
     
    }

export class AccessTokenRequest extends Request implements AccessTokenRequestType  {
      public name = ''
public token = ''
public plainTextToken = ''
public abilities = ''

      public async validate(): Promise<void> {
        await validateField('AccessToken', this.all())
      }
    }
    
    export const accessTokenRequest = new AccessTokenRequest()
    