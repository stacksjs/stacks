import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface PostRequestType extends RequestInstance{
      validate(params: any): void
    }

export class PostRequest extends Request implements PostRequestType  {
      
      public validate(params: any): void {
        validateField('Post', this.all())
      }
    }
    
    export const postRequest = new PostRequest()
    