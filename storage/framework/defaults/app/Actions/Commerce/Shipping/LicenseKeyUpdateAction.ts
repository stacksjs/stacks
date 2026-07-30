import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Update',
  description: 'LicenseKey Update ORM Action',
  method: 'PATCH',
  model: LicenseKey,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = request.getParam('id')
    const data = await request.all()

    const results = await shippings.licenses.update(id, data)

    return response.json(results)
  },
})
