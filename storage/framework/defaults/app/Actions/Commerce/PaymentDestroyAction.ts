import { Action } from '@stacksjs/actions'
import { payments } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Payment Destroy',
  description: 'Payment Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    await payments.destroy(id)

    return response.noContent()
  },
})
