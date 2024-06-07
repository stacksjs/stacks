import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { TeamRequestType } from '../types/requests'

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
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('Team', this.all())
      }
    }
    
    export const teamRequest = new TeamRequest()
    