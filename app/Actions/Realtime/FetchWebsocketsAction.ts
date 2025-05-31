import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Websockets Index',
  description: 'Websockets Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await db.selectFrom('websockets').selectAll().execute()

    return response.json(results)
  },
})
