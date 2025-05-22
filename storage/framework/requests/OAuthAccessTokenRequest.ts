import type { schema } from '@stacksjs/validation'
import type { OauthAccessTokenRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataOauthAccessToken {
  id: number
  token: string
  name: string
  scopes: string
  revoked: boolean
  expires_at: datetime
  oauth_client_id: number
  user_id: number
  created_at?: string
  updated_at?: string
}
export class OauthAccessTokenRequest extends Request<RequestDataOauthAccessToken> implements OauthAccessTokenRequestType {
  public id = 1
  public token = ''
  public name = ''
  public scopes = ''
  public revoked = false
  public expires_at = ''
  public oauth_client_id = 0
  public user_id = 0
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('OauthAccessToken', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const oauthAccessTokenRequest = new OauthAccessTokenRequest()
