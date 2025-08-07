import { Request } from '@stacksjs/router'
import { validateField, customValidate, type schema } from '@stacksjs/validation'
import type { MigrationsRequestType } from '../types/requests'

interface ValidationField {
      rule: ReturnType<typeof schema.string>
      message: Record<string, string>
    }

interface CustomAttributes {
      [key: string]: ValidationField
    }
interface RequestDataMigrations {
       name: string
      timestamp: string
     
    }
export class MigrationsRequest extends Request<RequestDataMigrations> implements MigrationsRequestType {
      public name = ''
public timestamp = ''

      public async validate(attributes?: CustomAttributes): Promise<void> {
        if (attributes === undefined || attributes === null) {
          await validateField('Migrations', this.all())
        } else {
          await customValidate(attributes, this.all())
        }
      }
    }

    export const migrationsRequest = new MigrationsRequest()
    