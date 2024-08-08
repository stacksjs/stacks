import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { TeamRequestType } from '../types/requests'

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
export class TeamRequest extends Request implements TeamRequestType {
  public id = 1
  public name = ''
  public companyName = ''
  public email = ''
  public billingEmail = ''
  public status = ''
  public description = ''
  public path = ''
  public isPersonal = false
  public accesstoken_id = 0
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Team', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new TeamRequest()
