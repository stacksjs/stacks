import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Store',
  description: 'LicenseKey Store ORM Action',
  method: 'POST',
  async handle(request: LicenseKeyRequestType) {
    await request.validate()
    const model = await LicenseKey.create(request.all())

    return response.json(model)
  },
})
