import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface TeamRequestType extends RequestInstance{
      validate(): void
       name: string
      companyName: string
      email: string
      billingEmail: string
      status: string
      description: string
      path: string
      isPersonal: boolean
     
    }

export class TeamRequest extends Request implements TeamRequestType  {
      public name = ''
public companyName = ''
public email = ''
public billingEmail = ''
public status = ''
public description = ''
public path = ''
public isPersonal = false

      public validate(): void {
        validateField('Team', this.all())
      }
    }
    
    export const teamRequest = new TeamRequest()
    