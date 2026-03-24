import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'JobStatsAction',
  description: 'Returns job statistics.',
  method: 'GET',
  async handle() {
    return {
      totalJobs: 15642,
      avgProcessingTime: '1.2s',
      jobsPerMinute: 23,
      failureRate: '2.3%',
      throughput: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        processed: Math.floor(Math.random() * 200) + 50,
        failed: Math.floor(Math.random() * 10),
      })),
      waitTime: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        avgWaitTime: Math.floor(Math.random() * 5000),
      })),
    }
  },
})
