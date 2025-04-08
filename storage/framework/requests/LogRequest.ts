import type { schema } from '@stacksjs/validation'
import type { LogRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataLog {
  id: number
  timestamp: number
  type: string[] | string
  source: string[] | string
  message: string
  project: string
  stacktrace: string
  file: string
  created_at?: string
  updated_at?: string
}
export class LogRequest extends Request<RequestDataLog> implements LogRequestType {
  public id = 1
  public timestamp = 0
  public type = []
  public source = []
  public message = ''
  public project = ''
  public stacktrace = ''
  public file = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Log', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const logRequest = new LogRequest()
