import type { JobRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataJob {
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: Date
  updated_at?: Date
}
export class JobRequest extends Request<RequestDataJob> implements JobRequestType {
  public id = 1
  public queue = ''
  public payload = ''
  public attempts = 0
  public available_at = 0
  public reserved_at = ''
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Job', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const JobRequest = new JobRequest()
