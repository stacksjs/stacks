import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Update',
  description: 'LicenseKey Update ORM Action',
  method: 'PUT',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    const results = await shippings.licenses.update(id, request)

    return response.json(results)
  },
})
