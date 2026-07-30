import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { Websocket } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { buildRealtimeStats } from './realtime-stats'

export default new Action({
  name: 'RealtimeStatsAction',
  description: 'Returns recorded websocket events and the configured connection endpoint.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const records = await Websocket.orderByDesc('id').limit(20_000).get()
      const realtimeConfig = config.realtime
      const scheme = String(realtimeConfig?.server?.scheme || 'ws')
      const configuredHost = String(realtimeConfig?.server?.host || 'localhost')
      const host = configuredHost === '0.0.0.0' ? 'localhost' : configuredHost
      const port = Number(realtimeConfig?.server?.port || 6001)

      return {
        config: {
          enabled: Boolean(realtimeConfig?.enabled),
          mode: String(realtimeConfig?.mode || 'server'),
          url: `${scheme}://${host}:${port}`,
        },
        ...buildRealtimeStats(records.map(record => ({
          id: String(record.get('id') || ''),
          type: String(record.get('type') || 'error'),
          socket: String(record.get('socket') || ''),
          details: String(record.get('details') || ''),
          time: Number(record.get('time') || 0),
          createdAt: String(record.get('created_at') || ''),
        }))),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Realtime events could not be loaded.',
      }, 503)
    }
  },
})
