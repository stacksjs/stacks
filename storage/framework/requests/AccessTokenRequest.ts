import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface AccessTokenRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'name' |'token' |'plainTextToken' |'abilities'): number | string | null
       id: number
 name: string
      token: string
      plainTextToken: string
      abilities: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class AccessTokenRequest extends Request implements AccessTokenRequestType  {
      public id = 1
public name = ''
public token = ''
public plainTextToken = ''
public abilities = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('AccessToken', this.all())
      }
    }
    
    export const accessTokenRequest = new AccessTokenRequest()
    