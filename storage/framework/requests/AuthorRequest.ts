import { Request } from '@stacksjs/router'
import { validateField, customValidate, type schema } from '@stacksjs/validation'
import type { AuthorRequestType } from '../types/requests'

interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }

interface CustomAttributes {
      [key: string]: ValidationField
    }
interface RequestDataAuthor {
       id: number
 name: string
      email: string
     created_at?: string
      updated_at?: string
    }
export class AuthorRequest extends Request<RequestDataAuthor> implements AuthorRequestType {
      public id = 1
public name = ''
public email = ''
public created_at = ''
        public updated_at = ''
      public uuid = ''
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('Author', this.all())
        } else {
          await customValidate(attributes, this.all())
        }

      }
    }

    export const authorRequest = new AuthorRequest()
    