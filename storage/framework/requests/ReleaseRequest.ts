import { Request } from '@stacksjs/router'
import type { VineType } from '@stacksjs/types'
import { validateField } from '@stacksjs/validation'
import { customValidate } from '@stacksjs/validation'

import type { ReleaseRequestType } from '../types/requests'

interface ValidationField {
  rule: ReturnType<typeof schema.string>
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}
interface RequestDataRelease {
  id?: number
  version: string
  created_at?: string
  updated_at?: string
  deleted_at?: string
}
export class ReleaseRequest extends Request<RequestDataRelease> implements ReleaseRequestType {
  public id = 1
  public version = ''
  public created_at = ''
  public updated_at = ''

  public async validate(attributes?: CustomAttributes): Promise<void> {
    if (attributes === undefined || attributes === null) {
      await validateField('Release', this.all())
    } else {
      await customValidate(attributes, this.all())
    }
  }
}

export const request = new ReleaseRequest()
