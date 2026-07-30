import { Action } from '@stacksjs/actions'
import { receipts } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Update',
  description: 'Updates a receipt print log through the native commerce module.',
  method: 'PATCH',
  model: Receipt,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const result = await receipts.update(id, data)

    return response.json(result)
  },
})
