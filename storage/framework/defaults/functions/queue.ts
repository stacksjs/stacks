/**
 * Queue Composable
 *
 * Provides data fetching for queue management dashboard.
 */

import { ref } from '@stacksjs/stx'
import { get, post } from './api'

export interface QueueStats {
  name: string
  size: number
  processing: number
  failed: number
  completed: number
  delayed: number
}

export interface QueueWorker {
  id: string
  name: string
  status: 'running' | 'paused' | 'stopped'
  queues: string[]
  jobs_processed: number
  uptime: string
  memory: string
}

export function useQueue() {
  const queues = ref<QueueStats[]>([])
  const workers = ref<QueueWorker[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchQueues() {
    try {
      const data = await get<{ data: QueueStats[] }>('/queue/stats')
      queues.value = data.data || []
    }
    catch (e) {
      console.error('Failed to fetch queue stats:', e)
      throw e
    }
  }

  async function fetchWorkers() {
    try {
      const data = await get<{ data: QueueWorker[] }>('/queue/workers')
      workers.value = data.data || []
    }
    catch (e) {
      console.error('Failed to fetch workers:', e)
      throw e
    }
  }

  async function fetchAll() {
    isLoading.value = true
    error.value = null

    try {
      await Promise.all([
        fetchQueues(),
        fetchWorkers(),
      ])
    }
    catch (e) {
      error.value = 'Failed to load queue data.'
    }
    finally {
      isLoading.value = false
    }
  }

  async function retryFailedJobs(queueName?: string) {
    try {
      await post('/queue/retry-failed', queueName ? { queue: queueName } : undefined)
      await fetchQueues()
    }
    catch (e) {
      error.value = 'Failed to retry failed jobs.'
      console.error('Failed to retry failed jobs:', e)
    }
  }

  async function pauseWorker(workerId: string) {
    try {
      await post(`/queue/workers/${workerId}/pause`)
      await fetchWorkers()
    }
    catch (e) {
      error.value = `Failed to pause worker ${workerId}.`
    }
  }

  async function resumeWorker(workerId: string) {
    try {
      await post(`/queue/workers/${workerId}/resume`)
      await fetchWorkers()
    }
    catch (e) {
      error.value = `Failed to resume worker ${workerId}.`
    }
  }

  return {
    queues,
    workers,
    isLoading,
    error,
    fetchQueues,
    fetchWorkers,
    fetchAll,
    retryFailedJobs,
    pauseWorker,
    resumeWorker,
  }
}
