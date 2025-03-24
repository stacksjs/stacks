import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Update',
  description: 'LicenseKey Update ORM Action',
  method: 'PATCH',
  async handle(request: LicenseKeyRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await LicenseKey.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
