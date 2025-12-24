// Core queue exports
export * from './action'
export * from './job'

// Legacy process (for backwards compatibility)
export {
  executeFailedJobs,
  getActiveJobCount,
  isWorkerRunning,
  isWorkerShuttingDown,
  processJobs,
  retryFailedJob,
  stopWorker,
} from './process'

// Enhanced processor with concurrent execution
export {
  getActiveJobCount as getProcessorActiveJobs,
  getProcessorConfig,
  isProcessorRunning,
  isProcessorShuttingDown,
  startProcessor,
  stopProcessor,
} from './processor'

// Scheduler for cron jobs
export {
  getRegisteredJobs,
  getSchedulerStatus,
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
  triggerJob,
} from './scheduler'

// Job discovery
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

// Testing utilities
export {
  createQueueTester,
  expectJobToFail,
  fake,
  getFakeQueue,
  isFaked,
  QueueTester,
  restore,
  runJob,
  type DispatchedJob,
} from './testing'

// Failed job notifications
export {
  configureFailedJobNotifications,
  FailedJobNotifier,
  getFailedJobNotifier,
  notifyJobFailed,
  type FailedJobInfo,
  type FailedJobNotificationConfig,
  type NotificationChannel,
} from './notifications'

// Health checks
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

// Queue facade and helpers
export {
  dispatch,
  dispatchLater,
  dispatchNow,
  getQueue,
  initQueue,
  queue,
  QueueFacade,
} from './facade'

// Stacks Job base class
export {
  BaseJob,
  Queueable,
  rateLimited,
  runAt,
  skipIf,
  withoutOverlapping,
  type JobConfig,
  type JobMiddleware as StacksJobMiddleware,
  type JobResult,
} from './base-job'

// Queue events
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

// Redis driver (bun-queue)
export * from './drivers/redis'

// Re-export bun-queue utilities for convenience
export {
  BatchProcessor,
  DatabaseQueue,
  DeadLetterQueue,
  DistributedLock,
  Job as BunQueueJob,
  JobBase,
  JobEvents as BunJobEvents,
  JobProcessor,
  LeaderElection,
  MemoryQueue,
  PriorityQueue,
  Queue as BunQueue,
  QueueGroup,
  QueueManager as BunQueueManager,
  QueueObservable,
  RateLimiter,
  Worker,
  WorkCoordinator,
  batch,
  chain,
  dispatch as bunDispatch,
  dispatchAfter,
  dispatchChain,
  dispatchFunction,
  dispatchIf,
  dispatchSync,
  dispatchUnless,
  middleware,
  FailureMiddleware,
  RateLimitMiddleware,
  SkipIfMiddleware,
  ThrottleMiddleware,
  UniqueJobMiddleware,
  WithoutOverlappingMiddleware,
  // Webhooks
  broadcastWebhook,
  createWebhookPayload,
  getWebhookManager,
  registerWebhook,
  sendWebhook,
  WebhookManager,
} from 'bun-queue'

// Re-export bun-queue types
export type {
  JobOptions as BunJobOptions,
  JobStatus as BunJobStatus,
  QueueConfig as BunQueueConfig,
  QueueConnectionConfig as BunQueueConnectionConfig,
  QueueManagerConfig as BunQueueManagerConfig,
  RateLimiter as BunRateLimiter,
  DeadLetterQueueOptions as BunDeadLetterQueueOptions,
  BatchOptions,
  Batch,
  BatchResult,
  DispatchChain,
  QueuedClosure,
  Dispatchable as BunDispatchable,
  InteractsWithQueue,
  JobContract,
  JobMiddleware,
  ShouldQueue,
  JobProcessorOptions,
  MiddlewareStack,
  MemoryQueueConfig,
  DatabaseQueueConfig,
  WebhookConfig,
  WebhookEventType,
  WebhookPayload,
  WebhookResult,
} from 'bun-queue'
