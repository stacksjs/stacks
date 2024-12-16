import type { AccessTokenRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string[]
  team_id: number
  created_at?: Date
  updated_at?: Date
  deleted_at?: Date
}
export class AccessTokenRequest extends Request<RequestDataAccessToken> implements AccessTokenRequestType {
  public id = 1
  public name = ''
  public token = ''
  public plain_text_token = ''
  public abilities = []
  public team_id = 0
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('AccessToken', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new AccessTokenRequest()
