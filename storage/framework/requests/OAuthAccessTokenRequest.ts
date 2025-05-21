import type { schema } from '@stacksjs/validation'
import type { OAuthAccessTokenRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataOAuthAccessToken {
  id: number
  token: string
  client_id: number
  name: string
  scopes: string
  revoked: boolean
  expires_at: timestamp
  user_id: number
  created_at?: string
  updated_at?: string
}
export class OAuthAccessTokenRequest extends Request<RequestDataOAuthAccessToken> implements OAuthAccessTokenRequestType {
  public id = 1
  public token = ''
  public client_id = 0
  public name = ''
  public scopes = ''
  public revoked = false
  public expires_at = ''
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('OAuthAccessToken', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const oAuthAccessTokenRequest = new OAuthAccessTokenRequest()
