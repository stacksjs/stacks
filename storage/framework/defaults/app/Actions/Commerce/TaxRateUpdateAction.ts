import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Update',
  description: 'Updates a tax rate through the native commerce module.',
  method: 'PATCH',
  model: TaxRate,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const model = await tax.update(id, data)

    return response.json(model)
  },
})
