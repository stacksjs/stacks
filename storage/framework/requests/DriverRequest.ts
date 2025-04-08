import type { schema } from '@stacksjs/validation'
import type { DriverRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataDriver {
  id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status: string[] | string
  user_id: number
  created_at?: string
  updated_at?: string
}
export class DriverRequest extends Request<RequestDataDriver> implements DriverRequestType {
  public id = 1
  public name = ''
  public phone = ''
  public vehicle_number = ''
  public license = ''
  public status = []
  public user_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Driver', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const driverRequest = new DriverRequest()
