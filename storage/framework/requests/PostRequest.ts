import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import type { PostRequestType } from '../types/requests'

export class PostRequest extends Request implements PostRequestType {
  public id = 1
  public title = ''
  public body = ''
  public user_id = 0
  public created_at = ''
  public updated_at = ''
  public deleted_at = ''

  public async validate(): Promise<void> {
    await validateField('Post', this.all())
  }
}

export const postRequest = new PostRequest()
