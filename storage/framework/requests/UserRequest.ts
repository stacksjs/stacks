import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface UserRequestType extends RequestInstance {
  validate(params: any): void
  email: string
  name: string
}

export class UserRequest extends Request implements UserRequestType  {
  public email = ''
  public name = ''

  public validate(params: any): void {
    validateField('User', this.all())
  }
}

export const userRequest = new UserRequest()
    