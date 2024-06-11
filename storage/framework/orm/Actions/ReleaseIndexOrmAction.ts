import { Action } from '@stacksjs/actions'
import type { ReleaseRequestType } from '../../types/requests'
import Release from '../src/models/Release'

export default new Action({
  name: 'Release Index',
  description: 'Release Index ORM Action',
  method: 'GET',
  async handle(request: ReleaseRequestType) {
    return await Release.all()
  },
})
