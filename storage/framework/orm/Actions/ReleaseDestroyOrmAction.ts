import { Action } from '@stacksjs/actions'
import Release from '../src/models/Release'
  import type { ReleaseRequestType } from '../../types/requests'

export default new Action({
      name: 'Release Destroy',
      description: 'Release Destroy ORM Action',
      method: 'DELETE',
      async handle(request: ReleaseRequestType) {
        const id = request.getParam('id')

        const model = await Release.findOrFail(Number(id))

        model.delete()

        return 'Model deleted!'
      },
    })
  