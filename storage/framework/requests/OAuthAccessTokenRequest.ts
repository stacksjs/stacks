import { Request } from '@stacksjs/router'
import { validateField, customValidate, type schema } from '@stacksjs/validation'
import type { OAuthAccessTokenRequestType } from '../types/requests'

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
      name: string
      scopes: string
      revoked: boolean
      expires_at: timestamp
     created_at?: string
      updated_at?: string
    }
export class OAuthAccessTokenRequest extends Request<RequestDataOAuthAccessToken> implements OAuthAccessTokenRequestType {
      public id = 1
public token = ''
public name = ''
public scopes = ''
public revoked = false
public expires_at = ''
public created_at = ''
        public updated_at = ''
      
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('OAuthAccessToken', this.all())
        } else {
          await customValidate(attributes, this.all())
        }
      }
    }

    export const oAuthAccessTokenRequest = new OAuthAccessTokenRequest()
    