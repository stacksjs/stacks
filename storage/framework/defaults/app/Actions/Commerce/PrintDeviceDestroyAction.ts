import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'PrintDevice Destroy',
  description: 'Deletes a print device through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Print device')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await devices.destroy(id)
    if (!deleted)
      return commerceNotFound('Print device', id)

    return response.noContent()
  },
})
