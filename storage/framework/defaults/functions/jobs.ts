/**
 * Jobs Composable
 *
 * Provides data fetching for job history and queue management.
 */

import { ref } from '@stacksjs/stx'
import { get, post } from './api'

export interface JobHistoryEntry {
  id: string
  name: string
  queue: string
  status: 'queued' | 'processing' | 'failed' | 'completed'
  attempts: number
  runtime?: number
  started_at?: string
  finished_at?: string
  error?: string
  payload: any
}

export function useJobs() {
  const jobs = ref<JobHistoryEntry[]>([])
  const totalJobs = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchJobs(params?: { page?: number, perPage?: number, queue?: string, status?: string, search?: string }) {
    isLoading.value = true
    error.value = null

    try {
      const query = new URLSearchParams()
      if (params?.page) query.set('page', String(params.page))
      if (params?.perPage) query.set('per_page', String(params.perPage))
      if (params?.queue && params.queue !== 'all') query.set('queue', params.queue)
      if (params?.status && params.status !== 'all') query.set('status', params.status)
      if (params?.search) query.set('search', params.search)

      const data = await get<{ data: JobHistoryEntry[], total: number }>(`/jobs?${query.toString()}`)
      jobs.value = data.data || []
      totalJobs.value = data.total || 0
    }
    catch (e) {
      error.value = 'Failed to load job history.'
      console.error('Failed to fetch jobs:', e)
    }
    finally {
      isLoading.value = false
    }
  }

  async function retryJob(jobId: string) {
    try {
      await post(`/jobs/${jobId}/retry`)
      // Refresh the job list after retry
      await fetchJobs()
    }
    catch (e) {
      error.value = `Failed to retry job ${jobId}.`
      console.error('Failed to retry job:', e)
    }
  }

  async function retryFailedJobs() {
    try {
      await post('/queue/retry-failed')
      await fetchJobs()
    }
    catch (e) {
      error.value = 'Failed to retry failed jobs.'
      console.error('Failed to retry failed jobs:', e)
    }
  }

  return {
    jobs,
    totalJobs,
    isLoading,
    error,
    fetchJobs,
    retryJob,
    retryFailedJobs,
  }
}
