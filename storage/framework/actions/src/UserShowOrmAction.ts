import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    // const id = request.getParam('id')

    const result = await db
      .with('posts', db => db
        .selectFrom('posts')
        .selectAll())
      .selectFrom('users')
      .selectAll()
      .execute()

    return response.json(result)
  },
})
