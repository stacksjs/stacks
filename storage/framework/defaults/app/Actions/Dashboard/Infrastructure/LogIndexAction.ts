import { Action } from '@stacksjs/actions'
import { Log } from '@stacksjs/orm'

export default new Action({
  name: 'LogIndexAction',
  description: 'Returns log data for the dashboard.',
  method: 'GET',
  async handle() {
    const levels = ['All', 'Error', 'Warning', 'Info', 'Debug']
    const sources = ['All Sources', 'api', 'auth', 'queue', 'http', 'cache', 'payment', 'deploy']

    try {
      const allLogs = await Log.orderByDesc('id').limit(50).get()
      const totalLogs = await Log.count()

      const logs = allLogs.map(l => ({
        timestamp: String(l.get('created_at') || l.get('timestamp') || ''),
        level: String(l.get('level') || 'info'),
        source: String(l.get('source') || l.get('channel') || ''),
        message: String(l.get('message') || ''),
        context: String(l.get('context') || ''),
      }))

      const errorCount = allLogs.filter(l => l.get('level') === 'error').length
      const warnCount = allLogs.filter(l => l.get('level') === 'warn' || l.get('level') === 'warning').length

      const stats = [
        { label: 'Total Logs (24h)', value: String(totalLogs) },
        { label: 'Errors', value: String(errorCount) },
        { label: 'Warnings', value: String(warnCount) },
        { label: 'Avg Response', value: '-' },
      ]

      return { logs, stats, levels, sources }
    }
    catch {
      return {
        logs: [],
        stats: [
          { label: 'Total Logs (24h)', value: '0' },
          { label: 'Errors', value: '0' },
          { label: 'Warnings', value: '0' },
          { label: 'Avg Response', value: '-' },
        ],
        levels,
        sources,
      }
    }
  },
})
