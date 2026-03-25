import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequestSuccessRate',
  description: 'Gets the request success rate of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Request.count()

    return {
      successRate: '-',
      totalRequests: count,
    }
  },
})
