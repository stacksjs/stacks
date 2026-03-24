import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs.',
  method: 'GET',
  async handle() {
    return {
      data: Array.from({ length: 25 }, (_, i) => ({
        id: `job-${1000 + i}`,
        name: ['SendEmailJob', 'ProcessPaymentJob', 'SyncInventoryJob', 'GenerateReportJob', 'CleanupTempFilesJob'][i % 5],
        queue: ['default', 'high', 'low'][i % 3],
        status: ['completed', 'completed', 'completed', 'failed', 'queued', 'processing'][i % 6],
        attempts: Math.floor(Math.random() * 3) + 1,
        runtime: Math.floor(Math.random() * 5000),
        started_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        finished_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        error: i % 6 === 3 ? 'Connection timeout after 30s' : undefined,
        payload: { userId: Math.floor(Math.random() * 100) },
      })),
      total: 156,
    }
  },
})
