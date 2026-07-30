import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Store',
  description: 'Creates a tax rate through the native commerce module.',
  method: 'POST',
  model: TaxRate,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await tax.store(data)

    return response.json(model)
  },
})
