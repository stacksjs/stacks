import type { schema } from '@stacksjs/validation'
import type { CommentableUpvotesRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataCommentableUpvotes {
  id: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at: string

}
export class CommentableUpvotesRequest extends Request<RequestDataCommentableUpvotes> implements CommentableUpvotesRequestType {
  public id = 0
  public user_id = 0
  public upvoteable_id = 0
  public upvoteable_type = ''
  public created_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('CommentableUpvotes', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const commentableUpvotesRequest = new CommentableUpvotesRequest()
