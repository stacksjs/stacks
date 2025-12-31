/**
 * @stacksjs/queue
 *
 * A thin wrapper around bun-queue that integrates with Stacks conventions.
 * Re-exports bun-queue functionality with Stacks-specific additions.
 */

// =============================================================================
// Core bun-queue exports - use these directly
// =============================================================================

// Queue and Job classes
export {
  Queue,
  Job as BunJob,
  JobBase,
  Worker,
  QueueManager,
  getQueueManager,
  setQueueManager,
  closeQueueManager,
} from 'bun-queue'

// Dispatch functions
export {
  dispatch,
  dispatchSync,
  dispatchIf,
  dispatchUnless,
  dispatchAfter,
  dispatchChain,
  dispatchFunction,
  chain,
  batch,
  DispatchableChain,
  JobBatch,
} from 'bun-queue'

// Processing
export {
  JobProcessor,
  createJobProcessor,
  getGlobalJobProcessor,
  setGlobalJobProcessor,
} from 'bun-queue'

// Batch processing
export { BatchProcessor } from 'bun-queue'

// Priority queue
export { PriorityQueue } from 'bun-queue'

// Dead letter queue
export { DeadLetterQueue } from 'bun-queue'

// Rate limiting
export { RateLimiter } from 'bun-queue'

// Distributed locking
export { DistributedLock } from 'bun-queue'

// Leader election (horizontal scaling)
export { LeaderElection } from 'bun-queue'

// Work coordination
export { WorkCoordinator } from 'bun-queue'

// Queue groups
export { QueueGroup } from 'bun-queue'

// Observable
export { QueueObservable } from 'bun-queue'

// Events
export { JobEvents } from 'bun-queue'

// Middleware
export {
  middleware,
  JobMiddlewareStack,
  RateLimitMiddleware,
  UniqueJobMiddleware,
  ThrottleMiddleware,
  WithoutOverlappingMiddleware,
  SkipIfMiddleware,
  FailureMiddleware,
} from 'bun-queue'

// Failed jobs (re-exported from bun-queue main)
export {
  FailedJobManager,
  DatabaseFailedJobProvider,
  RedisFailedJobProvider,
  type FailedJob,
  type FailedJobProvider,
} from 'bun-queue'

// Types
export type {
  JobOptions,
  JobStatus,
  QueueConfig,
  QueueConnectionConfig,
  QueueManagerConfig,
  Dispatchable,
  InteractsWithQueue,
  JobContract,
  JobMiddleware,
  ShouldQueue,
  JobProcessorOptions,
  MiddlewareStack,
  BatchOptions,
  Batch,
  BatchResult,
  DispatchChain,
  QueuedClosure,
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
