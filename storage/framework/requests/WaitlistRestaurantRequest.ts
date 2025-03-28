import type { schema } from '@stacksjs/validation'
import type { WaitlistRestaurantRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataWaitlistRestaurant {
  id: number
  name: string
  email: string
  phone: string
  party_size: number
  check_in_time: string
  table_preference: string[]
  status: string[]
  quoted_wait_time: number
  actual_wait_time: number
  queue_position: number
  customer_id: number
  created_at?: Date
  updated_at?: Date
}
export class WaitlistRestaurantRequest extends Request<RequestDataWaitlistRestaurant> implements WaitlistRestaurantRequestType {
  public id = 1
  public name = ''
  public email = ''
  public phone = ''
  public party_size = 0
  public check_in_time = ''
  public table_preference = []
  public status = []
  public quoted_wait_time = 0
  public actual_wait_time = 0
  public queue_position = 0
  public customer_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('WaitlistRestaurant', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const waitlistRestaurantRequest = new WaitlistRestaurantRequest()
