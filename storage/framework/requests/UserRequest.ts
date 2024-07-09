import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { UserRequestType } from '../types/requests'

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}
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

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('User', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const userRequest = new UserRequest()
