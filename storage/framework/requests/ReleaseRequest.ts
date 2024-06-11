import { Request } from '@stacksjs/router'
import { validateField } from '@stacksjs/validation'

import type { ReleaseRequestType } from '../types/requests'

export class ReleaseRequest extends Request implements ReleaseRequestType {
  public id = 1
  public version = ''
  public created_at = ''
  public updated_at = ''
  public deleted_at = ''

  public async validate(): Promise<void> {
    await validateField('Release', this.all())
  }
}

export const releaseRequest = new ReleaseRequest()
