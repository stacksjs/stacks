import { Action } from '@stacksjs/actions'
import type { ReleaseRequestType } from '../../types/requests'
import Release from '../src/models/Release'

export default new Action({
  name: 'Release Show',
  description: 'Release Show ORM Action',
  method: 'GET',
  async handle(request: ReleaseRequestType) {
    const id = await request.getParam('id')

    return await Release.findOrFail(Number(id))
  },
})
