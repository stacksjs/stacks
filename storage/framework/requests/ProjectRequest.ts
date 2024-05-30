import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface ProjectRequestType extends RequestInstance{
      validate(params: any): void
    }

export class ProjectRequest extends Request implements ProjectRequestType  {
      
      public validate(params: any): void {
        validateField('Project', this.all())
      }
    }