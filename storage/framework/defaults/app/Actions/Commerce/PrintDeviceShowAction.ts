import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'PrintDevice Show',
  description: 'PrintDevice Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Print device')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await devices.fetchById(id)
    if (!model)
      return commerceNotFound('Print device', id)

    return response.json(model)
  },
})
