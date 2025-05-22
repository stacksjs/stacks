import type { schema } from '@stacksjs/validation'
import type { OauthClientRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataOauthClient {
  id: number
  name: string
  secret: string
  provider: string
  redirect: string
  personal_access_client: boolean
  password_client: boolean
  revoked: boolean
  created_at?: string
  updated_at?: string
}
export class OauthClientRequest extends Request<RequestDataOauthClient> implements OauthClientRequestType {
  public id = 1
  public name = ''
  public secret = ''
  public provider = ''
  public redirect = ''
  public personal_access_client = false
  public password_client = false
  public revoked = false
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('OauthClient', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const oauthClientRequest = new OauthClientRequest()
