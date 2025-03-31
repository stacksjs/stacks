import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintDevice } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Destroy',
  description: 'PrintDevice Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PrintDeviceRequestType) {
    const id = request.getParam('id')

    const model = await PrintDevice.findOrFail(Number(id))

    model.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
