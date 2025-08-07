import { Request } from '@stacksjs/router'
import { validateField, customValidate, type schema } from '@stacksjs/validation'
import type { PasswordResetsRequestType } from '../types/requests'

interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }

interface CustomAttributes {
      [key: string]: ValidationField
    }
interface RequestDataPasswordResets {
       email: string
      token: string
      created_at: string
     
    }
export class PasswordResetsRequest extends Request<RequestDataPasswordResets> implements PasswordResetsRequestType {
      public email = ''
public token = ''
public created_at = ''

      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('PasswordResets', this.all())
        } else {
          await customValidate(attributes, this.all())
        }
      }
    }

    export const passwordResetsRequest = new PasswordResetsRequest()
    