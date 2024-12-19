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
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export class ErrorRequest extends Request<RequestDataError> implements ErrorRequestType {
  public id = 1
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

export const request = new ErrorRequest()
