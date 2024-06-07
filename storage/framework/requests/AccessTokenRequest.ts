import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { AccessTokenRequestType } from '../types/requests'

export class AccessTokenRequest extends Request implements AccessTokenRequestType {
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
    