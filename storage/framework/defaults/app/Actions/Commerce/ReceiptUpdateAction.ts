import { Action } from '@stacksjs/actions'
import { receipts } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Receipt Update',
  description: 'Updates a receipt print log through the native commerce module.',
  method: 'PATCH',
  model: Receipt,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Receipt')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const result = await receipts.update(id, data)
    if (!result)
      return commerceNotFound('Receipt', id)

    return response.json(result)
  },
})
