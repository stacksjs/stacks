import { Action } from '@stacksjs/actions'
import { devices } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'PrintDevice Update',
  description: 'Updates a print device through the native commerce module.',
  method: 'PATCH',
  model: PrintDevice,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Print device')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await devices.update(id, data)
    if (!model)
      return commerceNotFound('Print device', id)

    return response.json(model)
  },
})
