import { Action } from '@stacksjs/actions'
import { receipts } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Store',
  description: 'Creates a receipt print log through the native commerce module.',
  method: 'POST',
  model: Receipt,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await receipts.store(data)

    return response.json(model)
  },
})
