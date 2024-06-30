import { Action } from '@stacksjs/actions'
import type { ReleaseRequestType } from '../../types/requests'
import Release from '../src/models/Release'

export default new Action({
  name: 'Release Update',
  description: 'Release Update ORM Action',
  method: 'PATCH',
  async handle(request: ReleaseRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const model = await Release.findOrFail(Number(id))

    return model.update(request.all())
  },
})
