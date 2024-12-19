import type { ReleaseRequestType } from '../types/requests'
import { Request } from '@stacksjs/router'
import { customValidate, validateField } from '@stacksjs/validation'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataRelease {
  id: number
  version: string
  created_at?: Date
  updated_at?: Date
}
export class ReleaseRequest extends Request<RequestDataRelease> implements ReleaseRequestType {
  public id = 1
  public version = ''
  public created_at = new Date()
  public updated_at = new Date()

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Release', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new ReleaseRequest()
