/**
 * Realtime Composable
 */
import { ref } from '@stacksjs/stx'

const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

export interface RealtimeStats {
  connectionsTriggered: number
  connectionsChange: number
  avgLatency: string
  latencyChange: number
  successRate: string
  successChange: number
}

export interface ActiveConnection {
  id: string
  client: string
  status: string
  uptime: string
  messages: number
}

export function useRealtimeStats() {
  const stats = ref<RealtimeStats>({ connectionsTriggered: 0, connectionsChange: 0, avgLatency: '0ms', latencyChange: 0, successRate: '0%', successChange: 0 })
  const activeConnections = ref<ActiveConnection[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/realtime/stats`, {
        headers: { 'Accept': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        stats.value = data.stats || stats.value
        activeConnections.value = data.activeConnections || []
      }
    } catch (e) {
      error.value = 'Failed to load realtime stats.'
      console.error('Failed to fetch realtime stats:', e)
    } finally {
      isLoading.value = false
    }
  }

  return { stats, activeConnections, isLoading, error, fetchStats }
}
