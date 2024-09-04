import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { UserRequestType } from '../types/requests'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataUser {
  id?: number
  name: string
  email: string
  jobTitle: string
  password: string
  team_id: number
  deployment_id: number
  post_id: number
  created_at?: string
  updated_at?: string
  deleted_at?: string
}
export class UserRequest extends Request<RequestDataUser> implements UserRequestType {
  public id = 1
  public name = ''
  public email = ''
  public job_title = ''
  public password = ''
  public team_id = 0
  public deployment_id = 0
  public post_id = 0
  public created_at = ''
  public updated_at = ''

  public deleted_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('User', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new UserRequest()
