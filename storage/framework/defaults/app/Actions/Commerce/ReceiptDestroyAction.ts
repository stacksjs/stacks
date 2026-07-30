import { Action } from '@stacksjs/actions'

import { receipts } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Receipt Destroy',
  description: 'Deletes a receipt print log through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await receipts.destroy(id)

    return response.noContent()
  },
})
