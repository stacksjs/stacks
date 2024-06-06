import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface UserRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'name' |'email' |'jobTitle' |'password'): number | string | null
       id: number
 name: string
      email: string
      jobTitle: string
      password: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class UserRequest extends Request implements UserRequestType  {
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
    