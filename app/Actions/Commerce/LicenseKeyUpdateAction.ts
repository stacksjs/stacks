import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { licenses } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Update',
  description: 'LicenseKey Update ORM Action',
  method: 'PUT',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    const results = await licenses.update(Number(id), request)

    return response.json(results)
  },
})
