/**
 * @stacksjs/queue
 *
 * A thin wrapper around bun-queue that integrates with Stacks conventions.
 * Re-exports bun-queue functionality with Stacks-specific additions.
 */

// =============================================================================
// Core bun-queue exports
// =============================================================================

export {
  // Queue and Job classes
  Queue,
  Job as BunJob,
  JobBase,
  Worker,
  QueueManager,
  getQueueManager,
  setQueueManager,
  closeQueueManager,

  // Dispatch functions
  dispatch,
  dispatchSync,
  dispatchIf,
  dispatchUnless,
  dispatchAfter,
  dispatchChain,
  dispatchFunction,
  chain,
  batch,

  // Processing
  JobProcessor,
  createJobProcessor,
  getGlobalJobProcessor,
  setGlobalJobProcessor,

  // Batch processing
  BatchProcessor,

  // Priority queue
  PriorityQueue,

  // Dead letter queue
  DeadLetterQueue,

  // Rate limiting
  RateLimiter,

  // Distributed locking
  DistributedLock,

  // Leader election (horizontal scaling)
  LeaderElection,

  // Work coordination
  WorkCoordinator,

  // Queue groups
  QueueGroup,

  // Observable
  QueueObservable,

  // Events
  JobEvents,

  // Middleware
  middleware,
  RateLimitMiddleware,
  UniqueJobMiddleware,
  ThrottleMiddleware,
  WithoutOverlappingMiddleware,
  SkipIfMiddleware,
  FailureMiddleware,

  // Worker management
  QueueWorker,
  WorkerManager,
  type WorkerOptions,

  // Failed job management
  FailedJobManager,
  type FailedJob,
} from 'bun-queue'

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
