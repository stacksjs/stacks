import type { schema } from '@stacksjs/validation'
import type { DigitalDeliveryRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataDigitalDelivery {
  id: number
  name: string
  description: string
  download_limit: number
  expiry_days: number
  requires_login: boolean
  automatic_delivery: boolean
  status: string[] | string
  created_at?: string
  updated_at?: string
}
export class DigitalDeliveryRequest extends Request<RequestDataDigitalDelivery> implements DigitalDeliveryRequestType {
  public id = 1
  public name = ''
  public description = ''
  public download_limit = 0
  public expiry_days = 0
  public requires_login = false
  public automatic_delivery = false
  public status = []
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('DigitalDelivery', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const digitalDeliveryRequest = new DigitalDeliveryRequest()
