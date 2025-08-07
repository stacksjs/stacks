import type { schema } from '@stacksjs/validation'
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
  created_at?: string
  updated_at?: string
}
export class JobRequest extends Request<RequestDataJob> implements JobRequestType {
  public id = 1
  public queue = ''
  public payload = ''
  public attempts = 0
  public available_at = 0
  public reserved_at = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Job', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const jobRequest = new JobRequest()
