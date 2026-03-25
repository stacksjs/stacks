import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs.',
  method: 'GET',
  async handle() {
    try {
      const allJobs = await Job.orderByDesc('id').limit(50).get()

      const jobs = allJobs.map(j => ({
        id: String(j.get('id') || ''),
        name: String(j.get('name') || j.get('queue') || 'Unknown'),
        queue: String(j.get('queue') || '-'),
        status: String(j.get('status') || 'waiting'),
        attempts: Number(j.get('attempts') || 0),
        maxAttempts: Number(j.get('max_attempts') || 3),
        duration: j.get('duration') ? `${j.get('duration')}ms` : '-',
        createdAt: String(j.get('created_at') || '-'),
      }))

      return { jobs, queueConnected: true }
    }
    catch {
      return { jobs: [], queueConnected: false }
    }
  },
})
