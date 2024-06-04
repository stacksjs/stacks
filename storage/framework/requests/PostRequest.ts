import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import type { RequestInstance } from '@stacksjs/types'

export interface PostRequestType extends RequestInstance{
      validate(): void
       title: string
      body: string
     
    }

export class PostRequest extends Request implements PostRequestType  {
      public title = ''
public body = ''

      public validate(): void {
        validateField('Post', this.all())
      }
    }
    
    export const postRequest = new PostRequest()
    