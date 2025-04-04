import { Action } from '@stacksjs/actions'

import { licenses } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Index',
  description: 'LicenseKey Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await licenses.fetchAll()

    return response.json(results)
  },
})
