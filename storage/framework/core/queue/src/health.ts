/**
 * Queue Health Check Endpoint for Stacks
 *
 * Provides health check functionality for queue monitoring.
 */

import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/orm'
import { FailedJob } from '../../../orm/src/models/FailedJob'

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Queue health check result
 */
export interface QueueHealthResult {
  status: HealthStatus
  timestamp: string
  queues: QueueStatus[]
  workers: WorkerStatus[]
  metrics: QueueMetrics
  alerts: HealthAlert[]
}

/**
 * Individual queue status
 */
export interface QueueStatus {
  name: string
  status: HealthStatus
  pending: number
  processing: number
  delayed: number
  failed: number
  oldestJobAge?: number // in seconds
}

/**
 * Worker status
 */
export interface WorkerStatus {
  id: string
  status: 'active' | 'idle' | 'stopped'
  queue: string
  processedCount: number
  failedCount: number
  lastActivityAt?: string
}

/**
 * Queue metrics summary
 */
export interface QueueMetrics {
  totalPending: number
  totalProcessing: number
  totalDelayed: number
  totalFailed: number
  throughputPerMinute: number
  averageProcessingTime: number
  errorRate: number
}

/**
 * Health alert
 */
export interface HealthAlert {
  level: 'warning' | 'critical'
  message: string
  queue?: string
  timestamp: string
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /**
   * Maximum pending jobs before degraded status
   */
  maxPendingWarning?: number

  /**
   * Maximum pending jobs before unhealthy status
   */
  maxPendingCritical?: number

  /**
   * Maximum failed jobs before degraded status
   */
  maxFailedWarning?: number

  /**
   * Maximum failed jobs before unhealthy status
   */
  maxFailedCritical?: number

  /**
   * Maximum job age in seconds before warning
   */
  maxJobAgeWarning?: number

  /**
   * Maximum job age in seconds before critical
   */
  maxJobAgeCritical?: number

  /**
   * Maximum error rate (0-1) before warning
   */
  maxErrorRateWarning?: number

  /**
   * Maximum error rate (0-1) before critical
   */
  maxErrorRateCritical?: number

  /**
   * Queues to include in health check
   */
  queues?: string[]
}

/**
 * Default health check configuration
 */
const defaultConfig: HealthCheckConfig = {
  maxPendingWarning: 1000,
  maxPendingCritical: 5000,
  maxFailedWarning: 10,
  maxFailedCritical: 100,
  maxJobAgeWarning: 3600, // 1 hour
  maxJobAgeCritical: 86400, // 24 hours
  maxErrorRateWarning: 0.1, // 10%
  maxErrorRateCritical: 0.5, // 50%
}

/**
 * Perform queue health check
 */
export async function checkQueueHealth(config: HealthCheckConfig = {}): Promise<QueueHealthResult> {
  const cfg = { ...defaultConfig, ...config }
  const alerts: HealthAlert[] = []
  const now = new Date()
  const nowTimestamp = Math.floor(now.getTime() / 1000)

  try {
    // Get all jobs and failed jobs
    const jobs = await Job.all()
    const failedJobs = await FailedJob.all()

    // Group jobs by queue
    const queueMap = new Map<string, { pending: number, processing: number, delayed: number, oldestAge?: number }>()

    for (const job of jobs) {
      const queueName = job.queue || 'default'

      if (!queueMap.has(queueName)) {
        queueMap.set(queueName, { pending: 0, processing: 0, delayed: 0 })
      }

      const stats = queueMap.get(queueName)!

      if (job.reserved_at) {
        stats.processing++
      }
      else if (job.available_at && job.available_at > nowTimestamp) {
        stats.delayed++
      }
      else {
        stats.pending++

        // Track oldest job age
        if (job.created_at) {
          const createdAt = typeof job.created_at === 'number'
            ? job.created_at
            : Math.floor(new Date(job.created_at).getTime() / 1000)
          const age = nowTimestamp - createdAt

          if (!stats.oldestAge || age > stats.oldestAge) {
            stats.oldestAge = age
          }
        }
      }
    }

    // Group failed jobs by queue
    const failedByQueue = new Map<string, number>()
    for (const fj of failedJobs) {
      const queueName = fj.queue || 'default'
      failedByQueue.set(queueName, (failedByQueue.get(queueName) || 0) + 1)
    }

    // Build queue statuses
    const queueStatuses: QueueStatus[] = []
    const allQueues = new Set([...queueMap.keys(), ...failedByQueue.keys()])

    // Filter queues if specified
    const queuesToCheck = cfg.queues
      ? [...allQueues].filter(q => cfg.queues!.includes(q))
      : [...allQueues]

    let totalPending = 0
    let totalProcessing = 0
    let totalDelayed = 0
    let totalFailed = 0

    for (const queueName of queuesToCheck) {
      const stats = queueMap.get(queueName) || { pending: 0, processing: 0, delayed: 0 }
      const failed = failedByQueue.get(queueName) || 0

      totalPending += stats.pending
      totalProcessing += stats.processing
      totalDelayed += stats.delayed
      totalFailed += failed

      // Determine queue status
      let status: HealthStatus = 'healthy'

      // Check pending jobs
      if (stats.pending >= cfg.maxPendingCritical!) {
        status = 'unhealthy'
        alerts.push({
          level: 'critical',
          message: `Queue "${queueName}" has ${stats.pending} pending jobs (threshold: ${cfg.maxPendingCritical})`,
          queue: queueName,
          timestamp: now.toISOString(),
        })
      }
      else if (stats.pending >= cfg.maxPendingWarning!) {
        status = status === 'healthy' ? 'degraded' : status
        alerts.push({
          level: 'warning',
          message: `Queue "${queueName}" has ${stats.pending} pending jobs (threshold: ${cfg.maxPendingWarning})`,
          queue: queueName,
          timestamp: now.toISOString(),
        })
      }

      // Check failed jobs
      if (failed >= cfg.maxFailedCritical!) {
        status = 'unhealthy'
        alerts.push({
          level: 'critical',
          message: `Queue "${queueName}" has ${failed} failed jobs (threshold: ${cfg.maxFailedCritical})`,
          queue: queueName,
          timestamp: now.toISOString(),
        })
      }
      else if (failed >= cfg.maxFailedWarning!) {
        status = status === 'healthy' ? 'degraded' : status
        alerts.push({
          level: 'warning',
          message: `Queue "${queueName}" has ${failed} failed jobs (threshold: ${cfg.maxFailedWarning})`,
          queue: queueName,
          timestamp: now.toISOString(),
        })
      }

      // Check oldest job age
      if (stats.oldestAge) {
        if (stats.oldestAge >= cfg.maxJobAgeCritical!) {
          status = 'unhealthy'
          alerts.push({
            level: 'critical',
            message: `Queue "${queueName}" has a job waiting for ${Math.floor(stats.oldestAge / 3600)} hours`,
            queue: queueName,
            timestamp: now.toISOString(),
          })
        }
        else if (stats.oldestAge >= cfg.maxJobAgeWarning!) {
          status = status === 'healthy' ? 'degraded' : status
          alerts.push({
            level: 'warning',
            message: `Queue "${queueName}" has a job waiting for ${Math.floor(stats.oldestAge / 60)} minutes`,
            queue: queueName,
            timestamp: now.toISOString(),
          })
        }
      }

      queueStatuses.push({
        name: queueName,
        status,
        pending: stats.pending,
        processing: stats.processing,
        delayed: stats.delayed,
        failed,
        oldestJobAge: stats.oldestAge,
      })
    }

    // Calculate overall metrics
    const totalJobs = totalPending + totalProcessing + totalDelayed + totalFailed
    const errorRate = totalJobs > 0 ? totalFailed / totalJobs : 0

    // Determine overall status
    let overallStatus: HealthStatus = 'healthy'
    if (queueStatuses.some(q => q.status === 'unhealthy')) {
      overallStatus = 'unhealthy'
    }
    else if (queueStatuses.some(q => q.status === 'degraded')) {
      overallStatus = 'degraded'
    }

    // Check overall error rate
    if (errorRate >= cfg.maxErrorRateCritical!) {
      overallStatus = 'unhealthy'
      alerts.push({
        level: 'critical',
        message: `Overall error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${cfg.maxErrorRateCritical! * 100}%)`,
        timestamp: now.toISOString(),
      })
    }
    else if (errorRate >= cfg.maxErrorRateWarning!) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus
      alerts.push({
        level: 'warning',
        message: `Overall error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${cfg.maxErrorRateWarning! * 100}%)`,
        timestamp: now.toISOString(),
      })
    }

    return {
      status: overallStatus,
      timestamp: now.toISOString(),
      queues: queueStatuses,
      workers: [], // TODO: Implement worker status tracking
      metrics: {
        totalPending,
        totalProcessing,
        totalDelayed,
        totalFailed,
        throughputPerMinute: 0, // TODO: Calculate from metrics
        averageProcessingTime: 0, // TODO: Calculate from metrics
        errorRate,
      },
      alerts,
    }
  }
  catch (error) {
    log.error('Failed to perform queue health check:', error)

    return {
      status: 'unhealthy',
      timestamp: now.toISOString(),
      queues: [],
      workers: [],
      metrics: {
        totalPending: 0,
        totalProcessing: 0,
        totalDelayed: 0,
        totalFailed: 0,
        throughputPerMinute: 0,
        averageProcessingTime: 0,
        errorRate: 0,
      },
      alerts: [{
        level: 'critical',
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: now.toISOString(),
      }],
    }
  }
}

/**
 * Create a health check HTTP handler
 */
export function createHealthCheckHandler(config: HealthCheckConfig = {}): (req: Request) => Promise<Response> {
  return async (_req: Request) => {
    const result = await checkQueueHealth(config)

    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503

    return new Response(JSON.stringify(result, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }
}

/**
 * Quick health check - returns just the status
 */
export async function isQueueHealthy(config: HealthCheckConfig = {}): Promise<boolean> {
  const result = await checkQueueHealth(config)
  return result.status === 'healthy'
}
