import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

deleted_at?: Dateimport type { SubscriberEmailRequestType } from '../types/requests'

interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }

interface CustomAttributes {
      [key: string]: ValidationField
    }
interface RequestDataSubscriberEmail {
       id: number
 email: string
     created_at?: Date
      updated_at?: Date
    }
export class SubscriberEmailRequest extends Request<RequestDataSubscriberEmail> implements SubscriberEmailRequestType {
      public id = 1
public email = ''
public created_at = new Date
        public updated_at = new Date
      
        public deleted_at = ''
      
      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('SubscriberEmail', this.all())
        } else {
          await customValidate(attributes, this.all())
        }

      }
    }

    export const request = new SubscriberEmailRequest()
    