import { Action } from '@stacksjs/actions/runtime'
import { discoverJobs } from '@stacksjs/queue'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'Job Definitions',
  description: 'Discover application jobs and their queue, schedule and retry conventions without dispatching them.',
  method: 'GET',
  async handle() {
    try {
      const jobs = await discoverJobs(undefined, { strict: true })
      return { data: jobs.map(job => ({
        name: job.name,
        description: job.config.description ?? '',
        queue: job.config.queue ?? 'default',
        tries: job.config.tries ?? 3,
        timeout: job.config.timeout ?? null,
        schedule: job.config.rate ?? job.config.schedule ?? '',
        enabled: job.config.enabled !== false,
      })).sort((a, b) => a.name.localeCompare(b.name)) }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Job definitions could not be loaded.', 'JobDefinitionsAction')
    }
  },
})
