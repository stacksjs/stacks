import { Action } from '@stacksjs/actions'
import { Websocket } from '@stacksjs/orm'

export default new Action({
  name: 'RealtimeStatsAction',
  description: 'Returns realtime connection statistics.',
  method: 'GET',
  async handle() {
    try {
      const allConnections = await Websocket.all()
      const totalConnections = await Websocket.count()

      // Group connections by channel
      const channelMap: Record<string, { connections: number, messages: number }> = {}
      for (const conn of allConnections) {
        const channel = String(conn.get('channel') || conn.get('name') || 'default')
        if (!channelMap[channel]) {
          channelMap[channel] = { connections: 0, messages: 0 }
        }
        channelMap[channel].connections++
        channelMap[channel].messages += Number(conn.get('message_count') || 0)
      }

      const channels = Object.entries(channelMap).map(([name, data]) => ({
        name,
        connections: data.connections,
        messages: `${data.messages}/min`,
      }))

      return {
        channels,
        stats: {
          activeConnections: totalConnections,
          messagesPerMinute: '-',
          avgLatency: '-',
        },
      }
    }
    catch {
      return {
        channels: [],
        stats: {
          activeConnections: 0,
          messagesPerMinute: '0',
          avgLatency: '-',
        },
      }
    }
  },
})
