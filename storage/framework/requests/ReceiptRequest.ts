import type { schema } from '@stacksjs/validation'
import type { ReceiptRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataReceipt {
  id: number
  printer: string
  document: string
  timestamp: number
  status: string[]
  size: number
  pages: number
  duration: number
  print_device_id: number
  created_at?: Date
  updated_at?: Date
}
export class ReceiptRequest extends Request<RequestDataReceipt> implements ReceiptRequestType {
  public id = 1
  public printer = ''
  public document = ''
  public timestamp = 0
  public status = []
  public size = 0
  public pages = 0
  public duration = 0
  public print_device_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Receipt', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const receiptRequest = new ReceiptRequest()
