import type { schema } from '@stacksjs/validation'
import type { ProjectRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProject {
  id: number
  name: string
  description: string
  url: string
  status: string
  created_at?: string
  updated_at?: string
}
export class ProjectRequest extends Request<RequestDataProject> implements ProjectRequestType {
  public id = 1
  public name = ''
  public description = ''
  public url = ''
  public status = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Project', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const projectRequest = new ProjectRequest()
