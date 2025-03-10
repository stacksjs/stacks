import type { schema } from '@stacksjs/validation'
import type { ProductReviewRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataProductReview {
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  created_at?: Date
  updated_at?: Date
}
export class ProductReviewRequest extends Request<RequestDataProductReview> implements ProductReviewRequestType {
  public id = 1
  public rating = 0
  public title = ''
  public content = ''
  public is_verified_purchase = false
  public is_approved = false
  public helpful_votes = 0
  public unhelpful_votes = 0
  public purchase_date = ''
  public images = ''
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('ProductReview', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const productReviewRequest = new ProductReviewRequest()
