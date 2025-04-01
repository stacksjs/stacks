import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Show',
  description: 'LicenseKey Show ORM Action',
  method: 'GET',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    const model = await LicenseKey.findOrFail(Number(id))

    return response.json(model)
  },
})
