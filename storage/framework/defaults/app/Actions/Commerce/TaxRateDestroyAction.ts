import { Action } from '@stacksjs/actions'
import { tax } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'TaxRate Destroy',
  description: 'Deletes a tax rate through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await tax.destroy(id)

    return response.noContent()
  },
})
