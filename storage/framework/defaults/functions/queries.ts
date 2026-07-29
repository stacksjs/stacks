import { dashboardApi } from './dashboard-api'

export interface DashboardQueryLog {
  id: number | string
  query: string
  normalizedQuery: string
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  duration: number
  connection: string
  status: 'completed' | 'failed' | 'slow'
  error: string
  executedAt: string
  model: string
  method: string
  rowsAffected: number | null
  memoryUsage: number | null
  tags: string[]
  affectedTables: string[]
  indexesUsed: string[]
  missingIndexes: string[]
  suggestions: string[]
}

export interface DashboardQueryResponse {
  enabled: boolean
  slowThreshold: number
  queries: DashboardQueryLog[]
  error?: string
}

export interface DashboardQueryShowResponse {
  query: DashboardQueryLog | null
}

export async function fetchDashboardQueries(): Promise<DashboardQueryResponse> {
  return dashboardApi<DashboardQueryResponse>('/api/dashboard/queries')
}

export async function fetchDashboardQuery(id: string): Promise<DashboardQueryLog | null> {
  const response = await dashboardApi<DashboardQueryShowResponse>(`/api/dashboard/queries/${encodeURIComponent(id)}`)
  return response.query
}
