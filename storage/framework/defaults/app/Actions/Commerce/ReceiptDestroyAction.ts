import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Receipt Destroy',
  description: 'Deletes a receipt print log through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Receipt')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await receipts.destroy(id)
    if (!deleted)
      return commerceNotFound('Receipt', id)

    return response.noContent()
  },
})
