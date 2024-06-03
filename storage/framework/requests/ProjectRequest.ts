import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface ProjectRequestType extends RequestInstance{
      validate(): void
       name: string
      description: string
      url: string
      status: string
     
    }

export class ProjectRequest extends Request implements ProjectRequestType  {
      public name = ''
public description = ''
public url = ''
public status = ''

      public validate(): void {
        validateField('Project', this.all())
      }
    }
    
    export const projectRequest = new ProjectRequest()
    