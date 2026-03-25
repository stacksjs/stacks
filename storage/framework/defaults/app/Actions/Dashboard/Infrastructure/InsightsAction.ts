import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'InsightsAction',
  description: 'Returns performance and infrastructure insights for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      performance: {
        avgResponseTime: '18ms',
        p95ResponseTime: '45ms',
        p99ResponseTime: '120ms',
        throughput: '1,234 req/min',
      },
      database: {
        avgQueryTime: '2.3ms',
        slowQueries: 5,
        totalQueries: 45231,
        connectionPoolUsage: '35%',
      },
      memory: {
        heapUsed: '128 MB',
        heapTotal: '256 MB',
        rss: '312 MB',
        external: '24 MB',
      },
    }
  },
})
