import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { ProjectRequestType } from '../types/requests'

export class ProjectRequest extends Request implements ProjectRequestType {
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
    