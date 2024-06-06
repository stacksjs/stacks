import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface ProjectRequestType extends RequestInstance{
      validate(): void
      getParam(key: 'id' |'name' |'description' |'url' |'status'): number | string | null
       id: number
 name: string
      description: string
      url: string
      status: string
     created_at: Date
      updated_at: Date
      deleted_at: Date
    }

export class ProjectRequest extends Request implements ProjectRequestType  {
      public id = 1
public name = ''
public description = ''
public url = ''
public status = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('Project', this.all())
      }
    }
    
    export const projectRequest = new ProjectRequest()
    