import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'LogIndexAction',
  description: 'Returns log data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, level: 'error', message: 'Database connection timeout', context: 'DatabaseManager', timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: 2, level: 'warning', message: 'Rate limit approaching for IP 192.168.1.1', context: 'Throttle', timestamp: new Date(Date.now() - 7200000).toISOString() },
        { id: 3, level: 'info', message: 'User chris@stacks.dev logged in', context: 'Auth', timestamp: new Date(Date.now() - 10800000).toISOString() },
        { id: 4, level: 'debug', message: 'Query executed in 12ms', context: 'QueryBuilder', timestamp: new Date(Date.now() - 14400000).toISOString() },
      ],
    }
  },
})
