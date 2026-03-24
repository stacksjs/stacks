import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'RealtimeStatsAction',
  description: 'Returns realtime connection statistics.',
  method: 'GET',
  async handle() {
    return {
      stats: {
        connectionsTriggered: 71897,
        connectionsChange: 12.5,
        avgLatency: '24ms',
        latencyChange: -3.2,
        successRate: '99.8%',
        successChange: 0.1,
      },
      activeConnections: [
        { id: 'conn-1', client: 'Dashboard', status: 'connected', uptime: '2h 15m', messages: 1432 },
        { id: 'conn-2', client: 'Mobile App', status: 'connected', uptime: '45m', messages: 876 },
        { id: 'conn-3', client: 'API Client', status: 'connected', uptime: '1h 30m', messages: 2341 },
      ],
    }
  },
})
