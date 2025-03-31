import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintDevice } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Update',
  description: 'PrintDevice Update ORM Action',
  method: 'PATCH',
  async handle(request: PrintDeviceRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await PrintDevice.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
