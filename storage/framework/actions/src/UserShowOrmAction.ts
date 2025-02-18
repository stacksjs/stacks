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

    const result = await User.create({
      name: 'Glenn',
      email: 'gtorregosa@gmail.com',
      password: '123456',
      job_title: 'test',
    })

    return response.json(result)
  },
})
