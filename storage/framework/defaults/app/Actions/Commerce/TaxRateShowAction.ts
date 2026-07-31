import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'TaxRate Show',
  description: 'TaxRate Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Tax rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await tax.fetchById(id)
    if (!model)
      return commerceNotFound('Tax rate', id)

    return response.json(model)
  },
})
