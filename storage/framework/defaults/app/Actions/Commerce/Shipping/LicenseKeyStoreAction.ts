import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Store',
  description: 'LicenseKey Store ORM Action',
  method: 'POST',
  model: LicenseKey,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = await request.all()

    const results = await shippings.licenses.store(data)

    return response.json(results)
  },
})
