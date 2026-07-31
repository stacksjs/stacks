import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'TaxRate Destroy',
  description: 'Deletes a tax rate through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Tax rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await tax.destroy(id)
    if (!deleted)
      return commerceNotFound('Tax rate', id)

    return response.noContent()
  },
})
