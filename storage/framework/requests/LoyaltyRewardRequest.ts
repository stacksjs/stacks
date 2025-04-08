import type { schema } from '@stacksjs/validation'
import type { LoyaltyRewardRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataLoyaltyReward {
  id: number
  name: string
  description: string
  points_required: number
  reward_type: string
  discount_percentage: number
  free_product_id: string
  is_active: boolean
  expiry_days: number
  image_url: string
  created_at?: string
  updated_at?: string
}
export class LoyaltyRewardRequest extends Request<RequestDataLoyaltyReward> implements LoyaltyRewardRequestType {
  public id = 1
  public name = ''
  public description = ''
  public points_required = 0
  public reward_type = ''
  public discount_percentage = 0
  public free_product_id = ''
  public is_active = false
  public expiry_days = 0
  public image_url = ''
  public created_at = ''
  public updated_at = ''
  public uuid = ''
  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('LoyaltyReward', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const loyaltyRewardRequest = new LoyaltyRewardRequest()
