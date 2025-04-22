import type { schema } from '@stacksjs/validation'
import type { CustomerRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCustomer {
  id: number
  name: string
  email: string
  phone: string
  total_spent: number
  last_order: string
  status: string[] | string
  avatar: string
  user_id: number
  created_at?: string
  updated_at?: string
}
export class CustomerRequest extends Request<RequestDataCustomer> implements CustomerRequestType {
  public id = 1
  public name = ''
  public email = ''
  public phone = ''
  public total_spent = 0
  public last_order = ''
  public status = []
  public avatar = ''
  public user_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Customer', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const customerRequest = new CustomerRequest()
