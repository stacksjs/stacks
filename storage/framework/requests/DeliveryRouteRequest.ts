import type { schema } from '@stacksjs/validation'
import type { DeliveryRouteRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataDeliveryRoute {
  id: number
  driver: string
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active: timestamp
  driver_id: number
  created_at?: string
  updated_at?: string
}
export class DeliveryRouteRequest extends Request<RequestDataDeliveryRoute> implements DeliveryRouteRequestType {
  public id = 1
  public driver = ''
  public vehicle = ''
  public stops = 0
  public delivery_time = 0
  public total_distance = 0
  public last_active = ''
  public driver_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('DeliveryRoute', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const deliveryRouteRequest = new DeliveryRouteRequest()
