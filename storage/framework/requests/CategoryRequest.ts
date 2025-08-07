import type { schema } from '@stacksjs/validation'
import type { CategoryRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCategory {
  id: number
  name: string
  description: string
  slug: string
  image_url: string
  is_active: boolean
  parent_category_id: string
  display_order: number
  created_at?: string
  updated_at?: string
}
export class CategoryRequest extends Request<RequestDataCategory> implements CategoryRequestType {
  public id = 1
  public name = ''
  public description = ''
  public slug = ''
  public image_url = ''
  public is_active = false
  public parent_category_id = ''
  public display_order = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Category', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const categoryRequest = new CategoryRequest()
