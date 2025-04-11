import type { schema } from '@stacksjs/validation'
import type { CommentRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataComment {
  id: number
  title: string
  body: string
  status: string[] | string
  approved_at: number
  rejected_at: number
  user_id: number
  created_at?: string
  updated_at?: string
}
export class CommentRequest extends Request<RequestDataComment> implements CommentRequestType {
  public id = 1
  public title = ''
  public body = ''
  public status = []
  public approved_at = 0
  public rejected_at = 0
  public user_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Comment', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const commentRequest = new CommentRequest()
