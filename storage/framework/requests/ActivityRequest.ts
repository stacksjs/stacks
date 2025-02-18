import type { schema } from '@stacksjs/validation'
import type { ActivityRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataActivity {
  id: number
  title: string
  description: string
  address: string
  latlng: string
  info_source: string[]
  were_detained: boolean
  deleted_at?: Date
  created_at?: Date
  updated_at?: Date
}
export class ActivityRequest extends Request<RequestDataActivity> implements ActivityRequestType {
  public id = 1
  public title = ''
  public description = ''
  public address = ''
  public latlng = ''
  public info_source = ''
  public were_detained = false
  public created_at = new Date()
  public updated_at = new Date()

  public deleted_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Activity', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const activityRequest = new ActivityRequest()
