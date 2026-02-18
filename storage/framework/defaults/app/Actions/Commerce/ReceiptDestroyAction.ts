import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Destroy',
  description: 'Receipt Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    await receipts.destroy(id)

    return response.json({ message: 'Receipt deleted successfully' })
  },
})
