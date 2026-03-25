import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns queue statistics.',
  method: 'GET',
  async handle() {
    const count = await Job.count()

    const stats = {
      totalQueues: 0,
      totalJobs: count,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      throughputPerMinute: 0,
    }

    return { queues: [], stats }
  },
})
