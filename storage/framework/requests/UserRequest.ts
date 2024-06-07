import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { UserRequestType } from '../types/requests'

export class UserRequest extends Request implements UserRequestType {
      public id = 1
public name = ''
public email = ''
public jobTitle = ''
public password = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('User', this.all())
      }
    }
    
    export const userRequest = new UserRequest()
    