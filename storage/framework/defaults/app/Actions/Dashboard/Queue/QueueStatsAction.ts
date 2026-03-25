import { Action } from '@stacksjs/actions'
import { Job, FailedJob } from '@stacksjs/orm'

export default new Action({
  name: 'QueueStatsAction',
  description: 'Returns queue statistics.',
  method: 'GET',
  async handle() {
    try {
      const [totalJobs, failedJobCount, allJobs] = await Promise.all([
        Job.count(),
        FailedJob.count(),
        Job.all(),
      ])

      const activeJobs = allJobs.filter(j => j.get('status') === 'processing' || j.get('status') === 'active').length
      const completedJobs = allJobs.filter(j => j.get('status') === 'completed' || j.get('status') === 'done').length
      const pendingJobs = allJobs.filter(j => j.get('status') === 'pending' || j.get('status') === 'waiting').length

      // Group jobs by queue name
      const queueMap: Record<string, { pending: number, active: number, completed: number, failed: number, total: number }> = {}
      for (const j of allJobs) {
        const qName = String(j.get('queue') || 'default')
        if (!queueMap[qName]) {
          queueMap[qName] = { pending: 0, active: 0, completed: 0, failed: 0, total: 0 }
        }
        queueMap[qName].total++
        const status = String(j.get('status') || '')
        if (status === 'pending' || status === 'waiting') queueMap[qName].pending++
        else if (status === 'processing' || status === 'active') queueMap[qName].active++
        else if (status === 'completed' || status === 'done') queueMap[qName].completed++
        else if (status === 'failed') queueMap[qName].failed++
      }

      const queues = Object.entries(queueMap).map(([name, data]) => ({
        name,
        status: data.active > 0 ? 'active' : 'idle',
        pending: data.pending,
        active: data.active,
        completed: data.completed,
        failed: data.failed,
        total: data.total,
      }))

      const stats = {
        totalQueues: queues.length,
        totalJobs,
        activeJobs,
        completedJobs,
        failedJobs: failedJobCount,
        throughputPerMinute: 0,
      }

      return { queues, stats, queueConnected: true }
    }
    catch {
      return {
        queues: [],
        stats: { totalQueues: 0, totalJobs: 0, activeJobs: 0, completedJobs: 0, failedJobs: 0, throughputPerMinute: 0 },
        queueConnected: false,
      }
    }
  },
})
