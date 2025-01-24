import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { sql } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    // const id = request.getParam('id')

    const result = await User
      .select(sql.raw(`count(job_title) as job_title_count, job_title`))
      .groupBy('job_title')
      .get()

    return response.json(result)
  },
})
