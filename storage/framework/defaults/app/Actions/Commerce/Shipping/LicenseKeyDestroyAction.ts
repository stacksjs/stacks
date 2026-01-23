import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Destroy',
  description: 'LicenseKey Destroy ORM Action',
  method: 'DELETE',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    await shippings.licenses.destroy(id)

    return response.json({
      message: 'License key deleted successfully',
    })
  },
})
