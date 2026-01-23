import type { TaxRateRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Destroy',
  description: 'TaxRate Destroy ORM Action',
  method: 'DELETE',
  async handle(request: TaxRateRequestType) {
    const id = request.getParam('id')

    await tax.destroy(id)

    return response.json({ message: 'TaxRate deleted successfully' })
  },
})
