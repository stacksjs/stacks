import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'LicenseKey Show',
  description: 'LicenseKey Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await shippings.licenses.fetchById(id)

    return response.json(model)
  },
})
