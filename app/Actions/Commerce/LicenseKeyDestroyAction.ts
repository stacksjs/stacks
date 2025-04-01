import type { LicenseKeyRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'LicenseKey Destroy',
  description: 'LicenseKey Destroy ORM Action',
  method: 'DELETE',
  async handle(request: LicenseKeyRequestType) {
    const id = request.getParam('id')

    const model = await LicenseKey.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
