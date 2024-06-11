import { Action } from '@stacksjs/actions'
import Release from '../src/models/Release'
  import type { ReleaseRequestType } from '../../types/requests'

export default new Action({
      name: 'Release Show',
      description: 'Release Show ORM Action',
      method: 'GET',
      async handle(request: ReleaseRequestType) {
        const id = await request.getParam('id')

        return Release.findOrFail(Number(id))
      },
    })
  