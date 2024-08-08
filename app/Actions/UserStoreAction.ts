import { Action } from '@stacksjs/actions'
import type { UserRequestType } from '../../storage/framework/types/requests'

export default new Action({
  name: 'UserStoreAction',
  description: 'Store User Data',
  method: 'POST',
  requestFile: 'UserRequest',
  async handle(request: UserRequestType) {
    console.log(request)
    await request.validate()

    const model = await User.create(request.all())

    return model
  },
})
