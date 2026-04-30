/**
 * Queue Composable
 *
 * Provides data fetching for the queue dashboard. The shape mirrors what
 * `/queue/stats` and `/queue/workers` return, which in turn pull from the
 * framework's Job ORM and `@stacksjs/queue` metrics tracker.
 */

import { ref } from '@stacksjs/stx'
import { get, post } from './api'

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
    const data = await get<{ queues: QueueBucket[], stats: QueueAggregateStats, queueConnected: boolean }>('/queue/stats')
    queues.value = data.queues || []
    stats.value = data.stats || stats.value
    queueConnected.value = Boolean(data.queueConnected)
  }

  async function fetchWorkers() {
    const data = await get<{ data: QueueWorker[] }>('/queue/workers')
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
      await post<{ success: boolean, count: number, message: string }>('/queue/retry-failed')
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
