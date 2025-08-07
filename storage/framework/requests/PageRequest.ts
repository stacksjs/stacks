import type { schema } from '@stacksjs/validation'
import type { PageRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPage {
  id: number
  title: string
  template: string
  views: number
  published_at: timestamp
  conversions: number
  created_at?: string
  updated_at?: string
}
export class PageRequest extends Request<RequestDataPage> implements PageRequestType {
  public id = 1
  public title = ''
  public template = ''
  public views = 0
  public published_at = ''
  public conversions = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Page', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const pageRequest = new PageRequest()
