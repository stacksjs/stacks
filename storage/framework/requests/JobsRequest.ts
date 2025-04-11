import type { schema } from '@stacksjs/validation'
import type { JobsRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataJobs {
  id: number
  queue: string
  payload: string
  attempts: number
  available_at: number
  reserved_at: date
  created_at?: string
  updated_at?: string
}
export class JobsRequest extends Request<RequestDataJobs> implements JobsRequestType {
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
      await validateField('Jobs', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const jobsRequest = new JobsRequest()
