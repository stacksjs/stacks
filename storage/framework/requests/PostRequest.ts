import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { PostRequestType } from '../types/requests'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPost {
  id: number
  title: string
  body: string
  user_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export class PostRequest extends Request<RequestDataPost> implements PostRequestType {
  public id = 1
  public title = ''
  public body = ''
  public user_id = 0
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Post', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new PostRequest()
