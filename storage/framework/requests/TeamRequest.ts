import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import type { TeamRequestType } from '../types/requests'

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
  public created_at = ''
  public updated_at = ''
  public deleted_at = ''

  public async validate(): Promise<void> {
    await validateField('Team', this.all())
  }
}

export const teamRequest = new TeamRequest()
