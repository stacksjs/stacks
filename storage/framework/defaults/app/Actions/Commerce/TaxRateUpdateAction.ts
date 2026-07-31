import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'TaxRate Update',
  description: 'Updates a tax rate through the native commerce module.',
  method: 'PATCH',
  model: TaxRate,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Tax rate')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await tax.update(id, data)
    if (!model)
      return commerceNotFound('Tax rate', id)

    return response.json(model)
  },
})
