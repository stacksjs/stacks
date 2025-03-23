import type { schema } from '@stacksjs/validation'
import type { ReviewRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataReview {
  id: number
  rating: number
  title: string
  content: string
  is_verified_purchase: boolean
  is_approved: boolean
  is_featured: boolean
  helpful_votes: number
  unhelpful_votes: number
  purchase_date: string
  images: string
  customer_id: number
  product_id: number
  created_at?: Date
  updated_at?: Date
}
export class ReviewRequest extends Request<RequestDataReview> implements ReviewRequestType {
  public id = 1
  public rating = 0
  public title = ''
  public content = ''
  public is_verified_purchase = false
  public is_approved = false
  public is_featured = false
  public helpful_votes = 0
  public unhelpful_votes = 0
  public purchase_date = ''
  public images = ''
  public customer_id = 0
  public product_id = 0
  public created_at = new Date()
  public updated_at = new Date()
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Review', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const reviewRequest = new ReviewRequest()
