import type { schema } from '@stacksjs/validation'
import type { RequestRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataRequest {
  id: number
  method: string[]
  path: string
  status_code: number
  duration_ms: number
  ip_address: string
  memory_usage: number
  user_agent: string
  error_message: string
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export class RequestRequest extends Request<RequestDataRequest> implements RequestRequestType {
  public id = 1
  public method = []
  public path = ''
  public status_code = 0
  public duration_ms = 0
  public ip_address = ''
  public memory_usage = 0
  public user_agent = ''
  public error_message = ''
  public created_at = new Date()
  public updated_at = new Date()

  public deleted_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Request', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const requestRequest = new RequestRequest()
