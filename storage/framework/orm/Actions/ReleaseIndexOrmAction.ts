import { Action } from '@stacksjs/actions'
import Release from '../src/models/Release'
  import type { ReleaseRequestType } from '../../types/requests'

export default new Action({
      name: 'Release Index',
      description: 'Release Index ORM Action',
      method: 'GET',
      async handle(request: ReleaseRequestType) {
        return await Release.all()
      },
    })
  