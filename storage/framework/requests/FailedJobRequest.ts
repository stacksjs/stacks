import type { FailedJobRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataFailedJob {
  id: number
  connection: string
  queue: string
  payload: string
  exception: string
  failed_at: date
  created_at?: Date
  updated_at?: Date
}
export class FailedJobRequest extends Request<RequestDataFailedJob> implements FailedJobRequestType {
  public id = 1
  public connection = ''
  public queue = ''
  public payload = ''
  public exception = ''
  public failed_at = ''
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('FailedJob', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const failedjobRequest = new FailedJobRequest()
