import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import type { ProjectRequestType } from '../types/requests'

export class ProjectRequest extends Request implements ProjectRequestType {
  public id = 1
  public name = ''
  public description = ''
  public url = ''
  public status = ''
  public created_at = ''
  public updated_at = ''
  public deleted_at = ''

  public async validate(): Promise<void> {
    await validateField('Project', this.all())
  }
}

export const projectRequest = new ProjectRequest()
