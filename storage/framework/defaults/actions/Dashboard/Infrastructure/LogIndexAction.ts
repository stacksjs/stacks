import { Action } from '@stacksjs/actions'
import { Log } from '@stacksjs/orm'

export default new Action({
  name: 'LogIndexAction',
  description: 'Returns log data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Log.orderBy('created_at', 'desc').limit(50).get()
    const count = await Log.count()

    const stats = [
      { label: 'Total Logs (24h)', value: String(count) },
      { label: 'Errors', value: '-' },
      { label: 'Warnings', value: '-' },
      { label: 'Avg Response', value: '-' },
    ]

    const levels = ['All', 'Error', 'Warning', 'Info', 'Debug']
    const sources = ['All Sources', 'api', 'auth', 'queue', 'http', 'cache', 'payment', 'deploy']

    return {
      logs: items.map(i => i.toJSON()),
      stats,
      levels,
      sources,
    }
  },
})
