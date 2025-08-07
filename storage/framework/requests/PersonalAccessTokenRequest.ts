import type { schema } from '@stacksjs/validation'
import type { PersonalAccessTokenRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataPersonalAccessToken {
  id: number
  name: string
  token: string
  plain_text_token: string
  abilities: string
  last_used_at: timestamp
  expires_at: timestamp
  revoked_at: timestamp
  ip_address: string
  device_name: string
  is_single_use: boolean
  team_id: number
  user_id: number
  created_at?: string
  updated_at?: string
}
export class PersonalAccessTokenRequest extends Request<RequestDataPersonalAccessToken> implements PersonalAccessTokenRequestType {
  public id = 1
  public name = ''
  public token = ''
  public plain_text_token = ''
  public abilities = ''
  public last_used_at = ''
  public expires_at = ''
  public revoked_at = ''
  public ip_address = ''
  public device_name = ''
  public is_single_use = false
  public team_id = 0
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('PersonalAccessToken', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const personalAccessTokenRequest = new PersonalAccessTokenRequest()
