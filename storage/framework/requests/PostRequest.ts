import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import { PostRequestType } from '../types/requests'

export class PostRequest extends Request implements PostRequestType {
      public id = 1
public title = ''
public body = ''
public created_at = new Date()
      public updated_at = new Date()
      public deleted_at = new Date()
      
      public async validate(): Promise<void> {
        await validateField('Post', this.all())
      }
    }
    
    export const postRequest = new PostRequest()
    