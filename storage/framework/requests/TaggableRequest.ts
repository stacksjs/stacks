import type { schema } from '@stacksjs/validation'
import type { TaggableRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataTaggable {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  taggable_type: string
  created_at: string
  updated_at: string

}
export class TaggableRequest extends Request<RequestDataTaggable> implements TaggableRequestType {
  public id = 0
  public name = ''
  public slug = ''
  public description = ''
  public is_active = false
  public taggable_type = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Taggable', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const taggableRequest = new TaggableRequest()
