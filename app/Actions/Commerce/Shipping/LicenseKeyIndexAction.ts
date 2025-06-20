import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Index',
  description: 'LicenseKey Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await shippings.licenses.fetchAll()

    return response.json(results)
  },
})
