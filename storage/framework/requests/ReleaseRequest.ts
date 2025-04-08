import type { schema } from '@stacksjs/validation'
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
  name: string
  version: string
  created_at?: string
  updated_at?: string
}
export class ReleaseRequest extends Request<RequestDataRelease> implements ReleaseRequestType {
  public id = 1
  public name = ''
  public version = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Release', this.all())
    }
    else {
      await customValidate(attributes, this.all())
    }
  }
}

export const releaseRequest = new ReleaseRequest()
