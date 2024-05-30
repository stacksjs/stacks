import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface TeamRequestType extends RequestInstance{
      validate(params: any): void
    }

export class TeamRequest extends Request implements TeamRequestType  {
      
      public validate(params: any): void {
        validateField('Team', this.all())
      }
    }
    
    export const teamRequest = new TeamRequest()
    