/**
 * @stacksjs/queue
 *
 * A thin wrapper around bun-queue that integrates with Stacks conventions.
 * Core Stacks queue exports are always available. For advanced bun-queue
 * features (Queue, Worker, dispatch, etc.), import from '@stacksjs/queue/bun-queue'.
 */

// =============================================================================
// Stacks Job class for file-based jobs (app/Jobs/*.ts)
// =============================================================================
export { Job } from './action'

// =============================================================================
// Stacks job helper for dispatching file-based jobs
// =============================================================================
export { job, runJob } from './job'

// =============================================================================
// Job discovery (for app/Jobs directory)
// =============================================================================
export {
  discoverJobs,
  executeJob,
  getAllJobs,
  getJob,
  getScheduledJobs,
  jobRegistry,
  toJobOptions,
  type DiscoveredJob,
  type JobConfig,
} from './discovery'

// =============================================================================
// Stacks scheduler (integrates with job discovery)
// =============================================================================
export {
  getRegisteredJobs,
  getSchedulerStatus,
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
  triggerJob,
} from './scheduler'

// =============================================================================
// Stacks queue events (integrates with Stacks logging)
// =============================================================================
export {
  emitQueueEvent,
  getQueueEvents,
  onQueueEvent,
  OnQueueEvent,
  QueueEvents,
  QueueMetrics,
  withEvents,
  type QueueEventHandler,
  type QueueEventPayload,
  type QueueEventType,
} from './events'

// =============================================================================
// Health checks
// =============================================================================
export {
  checkQueueHealth,
  createHealthCheckHandler,
  isQueueHealthy,
  type HealthAlert,
  type HealthCheckConfig,
  type HealthStatus,
  type QueueHealthResult,
  type QueueMetrics as HealthQueueMetrics,
  type QueueStatus,
  type WorkerStatus,
} from './health'

// =============================================================================
// Failed job notifications
// =============================================================================
export {
  configureFailedJobNotifications,
  FailedJobNotifier,
  getFailedJobNotifier,
  notifyJobFailed,
  type FailedJobInfo,
  type FailedJobNotificationConfig,
  type NotificationChannel,
} from './notifications'

// =============================================================================
// Testing utilities
// =============================================================================
export {
  createQueueTester,
  expectJobToFail,
  fake,
  getFakeQueue,
  isFaked,
  QueueTester,
  restore,
  runJob as runTestJob,
  type DispatchedJob,
} from './testing'

// =============================================================================
// Worker functions (for queue:work command)
// =============================================================================
export {
  executeFailedJobs,
  getActiveJobCount,
  isWorkerRunning,
  retryFailedJob,
  startProcessor,
  stopProcessor,
} from './worker'
