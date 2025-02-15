import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    // const id = request.getParam('id')

    const result = await User.create({
      job_title: 'dev',
      name: 'Glenn',
      password: '123456',
      email: 'gtorregosa@gmail.com',
    })

    return response.json(result)
  },
})
