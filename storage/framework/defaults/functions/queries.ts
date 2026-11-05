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

export interface DashboardQueryCounts {
  total: number
  reads: number
  writes: number
  slow: number
  failed: number
  averageDuration: number
}

/** One page of the query log, chosen by the server (stacksjs/stacks#3204). */
export interface DashboardQueryResponse {
  enabled: boolean
  slowThreshold: number
  queries: DashboardQueryLog[]
  total: number
  page: number
  perPage: number
  counts: DashboardQueryCounts
  connections: string[]
  error?: string
}

export interface DashboardQueryFilters {
  range: 'hour' | 'day' | 'week'
  status: DashboardQueryLog['status'] | 'all'
  type: DashboardQueryLog['type'] | 'all'
  connection: string
  page: number
  perPage: number
}

export interface DashboardQueryShowResponse {
  query: DashboardQueryLog | null
}

export async function fetchDashboardQueries(filters: DashboardQueryFilters): Promise<DashboardQueryResponse> {
  const params = new URLSearchParams({
    range: filters.range,
    status: filters.status,
    type: filters.type,
    connection: filters.connection,
    page: String(filters.page),
    per_page: String(filters.perPage),
  })
  return dashboardApi<DashboardQueryResponse>(`/api/dashboard/queries?${params}`)
}

export async function fetchDashboardQuery(id: string): Promise<DashboardQueryLog | null> {
  const response = await dashboardApi<DashboardQueryShowResponse>(`/api/dashboard/queries/${encodeURIComponent(id)}`)
  return response.query
}
