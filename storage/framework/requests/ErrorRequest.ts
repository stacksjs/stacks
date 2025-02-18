import type { schema } from '@stacksjs/validation'
import type { ErrorRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataError {
  id: number
  type: string
  message: string
  stack: string
  status: number
  additional_info: string
  created_at?: Date
  updated_at?: Date
}
export class ErrorRequest extends Request<RequestDataError> implements ErrorRequestType {
  public id = 1
  public type = ''
  public message = ''
  public stack = ''
  public status = 0
  public additional_info = ''
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Error', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const errorRequest = new ErrorRequest()
