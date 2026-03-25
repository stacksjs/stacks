import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageJobTime',
  description: 'Gets the average job time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Job.count()

    return {
      averageJobTime: '-',
      totalJobs: count,
    }
  },
})
