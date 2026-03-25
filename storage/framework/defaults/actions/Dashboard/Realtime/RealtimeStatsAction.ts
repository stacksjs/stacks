import { Action } from '@stacksjs/actions'
import { Websocket } from '@stacksjs/orm'

export default new Action({
  name: 'RealtimeStatsAction',
  description: 'Returns realtime connection statistics.',
  method: 'GET',
  async handle() {
    const count = await Websocket.count()

    return {
      channels: [],
      stats: {
        activeConnections: count,
        messagesPerMinute: '-',
        avgLatency: '-',
      },
    }
  },
})
