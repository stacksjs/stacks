import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequests',
  description: 'Gets your requests.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const items = await Request.orderBy('created_at', 'desc').limit(50).get()

    return {
      requests: items.map(i => i.toJSON()),
    }
  },
})
