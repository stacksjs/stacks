import type { schema } from '@stacksjs/validation'
import type { PostRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

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
  poster: string
  content: string
  excerpt: string
  views: number
  published_at: timestamp
  status: string[] | string
  is_featured: number
  author_id: number
  created_at?: string
  updated_at?: string
}
export class PostRequest extends Request<RequestDataPost> implements PostRequestType {
  public id = 1
  public title = ''
  public poster = ''
  public content = ''
  public excerpt = ''
  public views = 0
  public published_at = ''
  public status = []
  public is_featured = 0
  public author_id = 0
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Post', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const postRequest = new PostRequest()
