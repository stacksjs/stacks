import type { schema } from '@stacksjs/validation'
import type { PostCategoryRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPostCategory {
  id: number
  name: string
  description: string
  slug: string
  post_id: number
  created_at?: string
  updated_at?: string
}
export class PostCategoryRequest extends Request<RequestDataPostCategory> implements PostCategoryRequestType {
  public id = 1
  public name = ''
  public description = ''
  public slug = ''
  public post_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PostCategory', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const postCategoryRequest = new PostCategoryRequest()
