import type { schema } from '@stacksjs/validation'
import type { PrintDeviceRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPrintDevice {
  id: number
  name: string
  mac_address: string
  location: string
  terminal: string
  status: string[] | string
  last_ping: number
  print_count: number
  created_at?: Date
  updated_at?: Date
}
export class PrintDeviceRequest extends Request<RequestDataPrintDevice> implements PrintDeviceRequestType {
  public id = 1
  public name = ''
  public mac_address = ''
  public location = ''
  public terminal = ''
  public status = []
  public last_ping = 0
  public print_count = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PrintDevice', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const printDeviceRequest = new PrintDeviceRequest()
