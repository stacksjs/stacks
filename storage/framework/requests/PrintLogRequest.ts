import type { schema } from '@stacksjs/validation'
import type { PrintLogRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPrintLog {
  id: number
  printer: string
  document: string
  timestamp: date
  status: string[]
  size: number
  pages: number
  duration: number
  created_at?: Date
  updated_at?: Date
}
export class PrintLogRequest extends Request<RequestDataPrintLog> implements PrintLogRequestType {
  public id = 1
  public printer = ''
  public document = ''
  public timestamp = ''
  public status = []
  public size = 0
  public pages = 0
  public duration = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PrintLog', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const printLogRequest = new PrintLogRequest()
