/**
 * Re-exports from bun-queue
 *
 * These are separated from the main barrel to avoid blocking the core
 * @stacksjs/queue exports when bun-queue has unresolvable dependencies.
 * Import from '@stacksjs/queue/bun-queue' when you need these features.
 */

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
  type JobEvents,

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
  // @ts-ignore - bun-queue resolved by Bun's module resolver
} from 'bun-queue'
