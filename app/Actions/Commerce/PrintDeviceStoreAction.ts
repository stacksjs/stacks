import type { PrintDeviceRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PrintDevice } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PrintDevice Store',
  description: 'PrintDevice Store ORM Action',
  method: 'POST',
  async handle(request: PrintDeviceRequestType) {
    await request.validate()
    const model = await PrintDevice.create(request.all())

    return response.json(model)
  },
})
