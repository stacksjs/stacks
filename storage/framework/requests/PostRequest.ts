import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { PostRequestType } from '../types/requests'

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPost {
  id?: number
  title: string
  body: string
  user_id: number
  created_at?: string
  updated_at?: string
  deleted_at?: string
}
export class PostRequest extends Request<RequestDataPost> implements PostRequestType {
  public id = 1
  public title = ''
  public body = ''
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Post', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new PostRequest()
