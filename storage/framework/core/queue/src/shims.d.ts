declare module 'redis' {
  export type RedisClient = any
  export function createClient(options?: { url?: string }): RedisClient
}

declare module 'bun-queue' {
  // Wide ambient: bun-queue isn't installed in node_modules; this shim
  // exists so that imports type-check. The actual values are resolved
  // by Bun's module resolver at runtime. Each name is declared as both
  // a class (so it can be used as a type and a value) and via `any`
  // semantics inside.
  export class Queue<T = any> {
    constructor(name: string, options?: any)
    add(data: T, options?: any): Promise<Job<T>>
    process(concurrency: number, handler: (job: Job<T>) => Promise<any>): void
    pause(): Promise<void>
    resume(): Promise<void>
    close(): Promise<void>
    getJobCounts(): Promise<any>
    [method: string]: any
  }
  export class Job<T = any> {
    id: string
    data: T;
    [key: string]: any
  }
  export class JobBase<T = any> {
    id: string
    data: T;
    [key: string]: any
  }
  export class Worker { [key: string]: any }
  export class QueueManager { [key: string]: any }
  export class JobProcessor { [key: string]: any }
  export class BatchProcessor { [key: string]: any }
  export class PriorityQueue { [key: string]: any }
  export class DeadLetterQueue { [key: string]: any }
  export class RateLimiter { [key: string]: any }
  export class DistributedLock { [key: string]: any }
  export class LeaderElection { [key: string]: any }
  export class WorkCoordinator { [key: string]: any }
  export class QueueGroup { [key: string]: any }
  export class QueueObservable { [key: string]: any }
  export class RateLimitMiddleware { [key: string]: any }
  export class UniqueJobMiddleware { [key: string]: any }
  export class ThrottleMiddleware { [key: string]: any }
  export class WithoutOverlappingMiddleware { [key: string]: any }
  export class SkipIfMiddleware { [key: string]: any }
  export class FailureMiddleware { [key: string]: any }
  export class QueueWorker { [key: string]: any }
  export class WorkerManager { [key: string]: any }
  export class FailedJobManager { [key: string]: any }
  export const middleware: any
  export function batch(...args: any[]): any
  export function chain(...args: any[]): any
  export function dispatch(...args: any[]): any
  export function dispatchAfter(...args: any[]): any
  export function dispatchSync(...args: any[]): any
  export function dispatchIf(...args: any[]): any
  export function dispatchUnless(...args: any[]): any
  export function dispatchChain(...args: any[]): any
  export function dispatchFunction(...args: any[]): any
  export function getQueueManager(...args: any[]): any
  export function setQueueManager(...args: any[]): any
  export function closeQueueManager(...args: any[]): any
  export function createJobProcessor(...args: any[]): any
  export function getGlobalJobProcessor(...args: any[]): any
  export function setGlobalJobProcessor(...args: any[]): any
  // Types
  export interface JobEvents { [key: string]: any }
  export interface WorkerOptions { [key: string]: any }
  export interface FailedJob { [key: string]: any }
}
