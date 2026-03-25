import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageRequestTime',
  description: 'Gets the average request time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Request.count()

    return {
      averageRequestTime: '-',
      totalRequests: count,
    }
  },
})
