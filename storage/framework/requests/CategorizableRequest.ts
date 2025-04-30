import type { schema } from '@stacksjs/validation'
import type { CategorizableRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCategorizable {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  categorizable_type: string
  created_at: string
  updated_at: string

}
export class CategorizableRequest extends Request<RequestDataCategorizable> implements CategorizableRequestType {
  public id = 0
  public name = ''
  public slug = ''
  public description = ''
  public is_active = false
  public categorizable_type = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Categorizable', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const categorizableRequest = new CategorizableRequest()
