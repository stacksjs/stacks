import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequestCount',
  description: 'Gets the total number of requests.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Request.count()
    return { count }
  },
})
