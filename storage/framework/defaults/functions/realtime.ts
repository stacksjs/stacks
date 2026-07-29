import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

export interface RealtimeEvent {
  id: string
  type: string
  socket: string
  details: string
  time: number
  createdAt: string
  occurredAt: string
}

export interface RealtimeDashboardResponse {
  config: {
    enabled: boolean
    mode: string
    url: string
  }
  overview: {
    recordedEvents: number
    uniqueSockets: number
    successes: number
    errors: number
    disconnections: number
    successRate: number
  }
  events: RealtimeEvent[]
}

export async function fetchRealtimeDashboard(): Promise<RealtimeDashboardResponse> {
  return await dashboardApi<RealtimeDashboardResponse>('/api/dashboard/realtime')
}

/** Compatibility shape retained for consumers of the previous composable. */
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
  const stats = ref<RealtimeStats>({
    connectionsTriggered: 0,
    connectionsChange: 0,
    avgLatency: '-',
    latencyChange: 0,
    successRate: '0%',
    successChange: 0,
  })
  const activeConnections = ref<ActiveConnection[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats() {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchRealtimeDashboard()
      stats.value = {
        connectionsTriggered: data.overview.recordedEvents,
        connectionsChange: 0,
        avgLatency: '-',
        latencyChange: 0,
        successRate: `${data.overview.successRate}%`,
        successChange: 0,
      }
      activeConnections.value = []
    }
    catch {
      error.value = 'Failed to load realtime stats.'
    }
    finally {
      isLoading.value = false
    }
  }

  return { stats, activeConnections, isLoading, error, fetchStats }
}
