import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { licenses } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Store',
  description: 'LicenseKey Store ORM Action',
  method: 'POST',
  async handle(request: LicenseKeyRequestType) {
    const results = await licenses.store(request)

    return response.json(results)
  },
})
