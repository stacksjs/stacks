import type { schema } from '@stacksjs/validation'
import type { LicenseKeyRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataLicenseKey {
  id: number
  key: string
  template: string[] | string
  expiry_date: date
  status: string[] | string
  customer_id: number
  product_id: number
  order_id: number
  created_at?: Date
  updated_at?: Date
}
export class LicenseKeyRequest extends Request<RequestDataLicenseKey> implements LicenseKeyRequestType {
  public id = 1
  public key = ''
  public template = []
  public expiry_date = ''
  public status = []
  public customer_id = 0
  public product_id = 0
  public order_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('LicenseKey', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const licenseKeyRequest = new LicenseKeyRequest()
