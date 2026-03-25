import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'JobStatsAction',
  description: 'Returns job statistics.',
  method: 'GET',
  async handle() {
    const count = await Job.count()

    return {
      totalJobs: count,
      avgProcessingTime: '-',
      jobsPerMinute: '-',
      failureRate: '-',
    }
  },
})
