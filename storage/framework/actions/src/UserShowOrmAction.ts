import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    const id = request.getParam('id')

    const user = await User.whereDoesntHave('posts', (query) => {
      query.where('job_title', 'Regional Brand Executive')
    }).first()

    // user?.update({ job_title: 'Senior Software Engineer' })
    // user?.delete()

    return response.json(user)
  },
})
