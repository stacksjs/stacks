import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Receipt Show',
  description: 'Receipt Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Receipt')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await receipts.fetchById(id)
    if (!model)
      return commerceNotFound('Receipt', id)

    return response.json(model)
  },
})
