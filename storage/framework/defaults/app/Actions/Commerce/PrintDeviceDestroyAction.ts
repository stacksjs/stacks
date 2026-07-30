import { Action } from '@stacksjs/actions'

import { devices } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Destroy',
  description: 'Deletes a print device through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    await devices.destroy(id)

    return response.noContent()
  },
})
