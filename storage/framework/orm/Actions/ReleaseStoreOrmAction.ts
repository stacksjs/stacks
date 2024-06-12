import { Action } from '@stacksjs/actions'
import Release from '../src/models/Release'
  import type { ReleaseRequestType } from '../../types/requests'

export default new Action({
      name: 'Release Store',
      description: 'Release Store ORM Action',
      method: 'POST',
      async handle(request: ReleaseRequestType) {
        await request.validate()
        const model = await Release.create(request.all())

        return model
      },
    })
  