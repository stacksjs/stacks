import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

export type JobStatus = 'queued' | 'processing' | 'failed'

export interface DashboardJob {
  id: string
  recordId: string
  source: 'job' | 'failed'
  name: string
  queue: string
  connection: string | null
  status: JobStatus
  attempts: number | null
  maxAttempts: number | null
  duration: string | null
  runtime: number | null
  error?: string
  payload: unknown
  created_at: string
  updated_at?: string
  available_at?: string
  reserved_at?: string
  started_at?: string
  finished_at?: string
}

export interface JobListResponse {
  data: DashboardJob[]
  total: number
  page: number
  perPage: number
  queues: string[]
  queueConnected: boolean
}

export interface JobStatsResponse {
  totalJobs: number
  totalFailed: number
  avgProcessingTime: string
  jobsPerMinute: number
  failureRate: string
}

export interface JobListFilters {
  page?: number
  perPage?: number
  queue?: string
  status?: string
  search?: string
}

export interface JobShowResponse {
  job: DashboardJob | null
  error?: string
}

export async function fetchJobs(filters: JobListFilters = {}): Promise<JobListResponse> {
  const query = new URLSearchParams()
  if (filters.page)
    query.set('page', String(filters.page))
  if (filters.perPage)
    query.set('per_page', String(filters.perPage))
  if (filters.queue && filters.queue !== 'all')
    query.set('queue', filters.queue)
  if (filters.status && filters.status !== 'all')
    query.set('status', filters.status)
  if (filters.search)
    query.set('search', filters.search)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return await dashboardApi<JobListResponse>(`/api/dashboard/jobs${suffix}`)
}

export async function fetchJobStats(): Promise<JobStatsResponse> {
  return await dashboardApi<JobStatsResponse>('/api/dashboard/jobs/stats')
}

export async function fetchJob(id: string): Promise<JobShowResponse> {
  return await dashboardApi<JobShowResponse>(`/api/dashboard/jobs/${encodeURIComponent(id)}`)
}

export async function retryJob(id: string): Promise<{ success: boolean, message: string }> {
  return await dashboardApi<{ success: boolean, message: string }>(`/api/dashboard/jobs/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  })
}

export async function retryFailedJobs(): Promise<{ success: boolean, message: string, count: number }> {
  return await dashboardApi<{ success: boolean, message: string, count: number }>('/api/dashboard/queue/retry-failed', {
    method: 'POST',
  })
}

/** Backwards-compatible alias for dashboard consumers using the older composable. */
export type JobHistoryEntry = DashboardJob

export function useJobs() {
  const jobs = ref<DashboardJob[]>([])
  const totalJobs = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function loadJobs(filters: JobListFilters = {}) {
    isLoading.value = true
    error.value = null
    try {
      const result = await fetchJobs(filters)
      jobs.value = result.data
      totalJobs.value = result.total
    }
    catch {
      error.value = 'Failed to load job history.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function retryOneJob(id: string) {
    try {
      await retryJob(id)
      await loadJobs()
    }
    catch {
      error.value = `Failed to retry job ${id}.`
    }
  }

  async function retryAllFailedJobs() {
    try {
      await retryFailedJobs()
      await loadJobs()
    }
    catch {
      error.value = 'Failed to retry failed jobs.'
    }
  }

  return {
    jobs,
    totalJobs,
    isLoading,
    error,
    fetchJobs: loadJobs,
    retryJob: retryOneJob,
    retryFailedJobs: retryAllFailedJobs,
  }
}
