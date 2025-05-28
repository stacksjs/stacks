import type { schema } from '@stacksjs/validation'
import type { UserRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataUser {
  id: number
  name: string
  email: string
  password: string
  team_id: number
  created_at?: string
  updated_at?: string
}
export class UserRequest extends Request<RequestDataUser> implements UserRequestType {
  public id = 1
  public name = ''
  public email = ''
  public password = ''
  public team_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('User', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const userRequest = new UserRequest()
