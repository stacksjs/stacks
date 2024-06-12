import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { UserRequestType } from '../types/requests'

export class UserRequest extends Request implements UserRequestType {
      public id = 1
public name = ''
public email = ''
public jobTitle = ''
public password = ''
public deployment_id = 0
public post_id = 0
public created_at = ''
      public updated_at = ''
      public deleted_at = ''
      
      public async validate(): Promise<void> {
        await validateField('User', this.all())
      }
    }
    
    export const userRequest = new UserRequest()
    