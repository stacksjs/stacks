import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'TaxRate Destroy',
  description: 'TaxRate Destroy ORM Action',
  method: 'DELETE',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam<number>('id')

    const model = await TaxRate.findOrFail(id)

    model.delete()

    return 'Model deleted!'
  },
})
