import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetJobsPerMinute',
  description: 'Gets the jobs per minute of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Job.count()

    return {
      jobsPerMinute: '-',
      totalJobs: count,
    }
  },
})
