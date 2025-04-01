import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Index',
  description: 'LicenseKey Index ORM Action',
  method: 'GET',
  async handle() {
    const results = LicenseKey.all()

    return response.json(results)
  },
})
