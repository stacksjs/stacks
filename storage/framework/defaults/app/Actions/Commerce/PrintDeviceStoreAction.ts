import { Action } from '@stacksjs/actions'
import { devices } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Store',
  description: 'Creates a print device through the native commerce module.',
  method: 'POST',
  model: PrintDevice,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await devices.store(data)

    return response.json(model)
  },
})
