import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface TeamRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'name' |'companyName' |'email' |'billingEmail' |'status' |'description' |'path' |'isPersonal'): number | string | null
       id: number
 name: string
      companyName: string
      email: string
      billingEmail: string
      status: string
      description: string
      path: string
      isPersonal: boolean
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class TeamRequest extends Request implements TeamRequestType  {
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
    