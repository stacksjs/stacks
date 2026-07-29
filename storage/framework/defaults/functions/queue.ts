/**
 * Queue Composable
 *
 * Provides data fetching for the queue dashboard. The shape mirrors what
 * `/queue/stats` and `/queue/workers` return, which in turn pull from the
 * framework's Job ORM and `@stacksjs/queue` metrics tracker.
 */

import { ref } from '@stacksjs/stx'
import { dashboardApi } from './dashboard-api'

export interface QueueBucket {
  name: string
  status: 'active' | 'idle'
  pending: number
  active: number
  completed: number
  failed: number
  total: number
}

export interface QueueAggregateStats {
  totalQueues: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  throughputPerMinute: number
  averageProcessingTimeMs: number
}

export interface QueueWorker {
  id: string
  name: string
  status: 'running' | 'paused' | 'stopped'
  queues: string[]
  jobs_processed: number
  failed_jobs: number
  uptime: string
  last_heartbeat: string
  memory: string
}

export interface QueueStatsResponse {
  queues: QueueBucket[]
  stats: QueueAggregateStats
  queueConnected: boolean
}

export interface QueueWorkersResponse {
  data: QueueWorker[]
  worker_running: boolean
  active_jobs: number
}

export async function fetchQueueStats(): Promise<QueueStatsResponse> {
  return await dashboardApi<QueueStatsResponse>('/api/dashboard/queue/stats')
}

export async function fetchQueueWorkers(): Promise<QueueWorkersResponse> {
  return await dashboardApi<QueueWorkersResponse>('/api/dashboard/queue/workers')
}

export async function retryQueueFailures(): Promise<{ success: boolean, count: number, message: string }> {
  return await dashboardApi<{ success: boolean, count: number, message: string }>('/api/dashboard/queue/retry-failed', {
    method: 'POST',
  })
}

export function useQueue() {
  const queues = ref<QueueBucket[]>([])
  const stats = ref<QueueAggregateStats>({
    totalQueues: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    throughputPerMinute: 0,
    averageProcessingTimeMs: 0,
  })
  const workers = ref<QueueWorker[]>([])
  const queueConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats() {
    const data = await fetchQueueStats()
    queues.value = data.queues || []
    stats.value = data.stats || stats.value
    queueConnected.value = Boolean(data.queueConnected)
  }

  async function fetchWorkers() {
    const data = await fetchQueueWorkers()
    workers.value = data.data || []
  }

  async function fetchAll() {
    isLoading.value = true
    error.value = null

    try {
      await Promise.all([fetchStats(), fetchWorkers()])
    }
    catch (e) {
      error.value = 'Failed to load queue data.'
      console.error('Failed to fetch queue data:', e)
    }
    finally {
      isLoading.value = false
    }
  }

  async function retryFailedJobs() {
    try {
      await retryQueueFailures()
      await fetchAll()
    }
    catch (e) {
      error.value = 'Failed to retry failed jobs.'
      console.error('Failed to retry failed jobs:', e)
    }
  }

  return {
    queues,
    stats,
    workers,
    queueConnected,
    isLoading,
    error,
    fetchStats,
    fetchWorkers,
    fetchAll,
    retryFailedJobs,
  }
}
