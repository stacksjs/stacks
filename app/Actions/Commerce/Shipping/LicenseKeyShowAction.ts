import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { licenses } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Show',
  description: 'LicenseKey Show ORM Action',
  method: 'GET',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    const model = await licenses.fetchById(id)

    return response.json(model)
  },
})
