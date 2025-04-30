import type { schema } from '@stacksjs/validation'
import type { CommentablesRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCommentables {
  id: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at: string
  updated_at: string | null

}
export class CommentablesRequest extends Request<RequestDataCommentables> implements CommentablesRequestType {
  public id = 0
  public title = ''
  public body = ''
  public status = ''
  public approved_at = null
  public rejected_at = null
  public commentables_id = 0
  public commentables_type = ''
  public user_id = null
  public created_at = ''
  public updated_at = null

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Commentables', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const commentablesRequest = new CommentablesRequest()
