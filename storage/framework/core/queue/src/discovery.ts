/**
 * Job Discovery for Stacks
 *
 * Automatically discovers and registers job classes from the app/Jobs directory.
 */

import { existsSync } from 'node:fs'
import type { JobOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'

/**
 * Discovered job metadata
 */
export interface DiscoveredJob {
  /** Job name (derived from filename or config) */
  name: string
  /** File path to the job */
  path: string
  /** Job configuration */
  config: JobConfig
  /** Whether it's a class-based or function-based job */
  type: 'class' | 'function'
  /** The job module */
  module: any
}

/**
 * Job configuration from discovery
 */
export interface JobConfig {
  name?: string
  description?: string
  queue?: string
  tries?: number
  enabled?: boolean
  backoff?: number | number[]
  rate?: string // Cron expression
  timeout?: number
  withoutOverlapping?: boolean
  retries?: number
  retryAfter?: number[]
  schedule?: string
  backoffConfig?: {
    strategy?: 'fixed' | 'exponential' | 'linear'
    initialDelay?: number
    factor?: number
    maxDelay?: number
    jitter?: {
      enabled?: boolean
      factor?: number
      minDelay?: number
      maxDelay?: number
    }
  }
}

/**
 * Job registry for managing discovered jobs
 */
class JobRegistry {
  private jobs: Map<string, DiscoveredJob> = new Map()
  private initialized = false

  /**
   * Register a discovered job
   */
  register(job: DiscoveredJob): void {
    this.jobs.set(job.name, job)
    log.debug(`Registered job: ${job.name} (${job.type})`)
  }

  /**
   * Get a job by name
   */
  get(name: string): DiscoveredJob | undefined {
    return this.jobs.get(name)
  }

  /**
   * Get all registered jobs
   */
  all(): DiscoveredJob[] {
    return Array.from(this.jobs.values())
  }

  /**
   * Get jobs by queue name
   */
  byQueue(queue: string): DiscoveredJob[] {
    return this.all().filter(job => job.config.queue === queue)
  }

  /**
   * Get scheduled jobs (those with cron expressions)
   */
  scheduled(): DiscoveredJob[] {
    return this.all().filter(job => job.config.enabled !== false && (job.config.rate || job.config.schedule))
  }

  /**
   * Check if a job is registered
   */
  has(name: string): boolean {
    return this.jobs.has(name)
  }

  /**
   * Clear all registered jobs
   */
  clear(): void {
    this.jobs.clear()
    this.initialized = false
  }

  /**
   * Mark as initialized
   */
  setInitialized(value: boolean): void {
    this.initialized = value
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }
}

// Global job registry
export const jobRegistry = new JobRegistry()

/**
 * Discover jobs from the app/Jobs directory
 */
export async function discoverJobs(jobsPath?: string, options: { strict?: boolean } = {}): Promise<DiscoveredJob[]> {
  const basePath = jobsPath || p.userJobsPath()
  const discovered: DiscoveredJob[] = []
  if (!existsSync(basePath)) return discovered

  try {
    const glob = new Bun.Glob('**/*.{ts,js}')
    const scanOptions = { cwd: basePath, onlyFiles: true, absolute: true }

    for await (const file of glob.scan(scanOptions)) {
      // Skip test files and index files
      if (file.endsWith('.d.ts') || file.includes('.test.') || file.includes('.spec.') || file.endsWith('index.ts') || file.endsWith('index.js')) {
        continue
      }

      try {
        const job = await loadJob(file, options.strict)
        if (job) {
          discovered.push(job)
          jobRegistry.register(job)
        }
      }
      catch (error) {
        if (options.strict) throw error
        log.warn(`Failed to load job from ${file}: ${(error as Error).message}`)
      }
    }

    jobRegistry.setInitialized(true)
    log.info(`Discovered ${discovered.length} jobs from ${basePath}`)

    return discovered
  }
  catch (error) {
    if (options.strict) throw error
    log.error(`Failed to discover jobs: ${(error as Error).message}`)
    return []
  }
}

/**
 * Load a single job file
 */
async function loadJob(filePath: string, strict = false): Promise<DiscoveredJob | null> {
  try {
    const module = await import(filePath)

    // Get the job name from the filename
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|js)$/, '') || 'UnknownJob'

    // Check if it's a class-based job (has static config and handle)
    if (module.default && typeof module.default === 'function') {
      const JobClass = module.default

      // Check for static properties indicating a class-based job
      if (typeof JobClass.handle === 'function' || typeof JobClass.prototype?.handle === 'function') {
        const config: JobConfig = JobClass.config || {}

        return {
          name: config.name || fileName,
          path: filePath,
          config: normalizeConfig(config, fileName),
          type: 'class',
          module: JobClass,
        }
      }
    }

    // Check if it's a function-based job (new Job({...}))
    if (module.default && typeof module.default === 'object') {
      const jobConfig = module.default

      // Function-based jobs have a handle function
      if (typeof jobConfig.handle === 'function' || typeof jobConfig.action === 'string') {
        return {
          name: jobConfig.name || fileName,
          path: filePath,
          config: normalizeConfig(jobConfig, fileName),
          type: 'function',
          module: jobConfig,
        }
      }
    }

    if (strict) throw new TypeError(`No executable job export in ${filePath}`)
    return null
  }
  catch (error) {
    if (strict) throw error
    log.debug(`Could not load job from ${filePath}: ${(error as Error).message}`)
    return null
  }
}

/** Both supported job forms use the same scheduling and retry contract. */
function normalizeConfig(config: JobConfig & { timeOut?: number }, fileName: string): JobConfig {
  return {
    name: config.name || fileName,
    description: config.description,
    queue: config.queue || 'default',
    enabled: config.enabled,
    tries: config.tries ?? config.retries ?? 3,
    backoff: config.backoff ?? config.retryAfter,
    rate: config.rate,
    schedule: config.schedule,
    timeout: config.timeout ?? config.timeOut,
    withoutOverlapping: config.withoutOverlapping,
    retryAfter: config.retryAfter,
    backoffConfig: config.backoffConfig,
  }
}

/**
 * Get a job by name from the registry
 */
export function getJob(name: string): DiscoveredJob | undefined {
  return jobRegistry.get(name)
}

/**
 * Get all discovered jobs
 */
export function getAllJobs(): DiscoveredJob[] {
  return jobRegistry.all()
}

/**
 * Get scheduled jobs
 */
export function getScheduledJobs(): DiscoveredJob[] {
  return jobRegistry.scheduled()
}

/**
 * Execute a job by name
 */
export async function executeJob<T = any>(name: string, payload?: any): Promise<T> {
  const job = jobRegistry.get(name)

  if (!job) {
    throw new Error(`Job "${name}" not found. Did you run discoverJobs()?`)
  }

  try {
    if (job.type === 'class') {
      // Class-based job
      if (typeof job.module.handle === 'function') {
        return await job.module.handle(payload)
      }
      // Instantiate and call handle
      const instance = new job.module()
      return await instance.handle(payload)
    }
    else {
      // Function-based job
      if (typeof job.module.handle === 'function') {
        return await job.module.handle(payload)
      }
      throw new Error(`Job "${name}" does not have a handle method`)
    }
  }
  catch (error) {
    log.error(`Failed to execute job "${name}": ${(error as Error).message}`)
    throw error
  }
}

/**
 * Convert discovered job config to bun-queue JobOptions
 */
export function toJobOptions(job: DiscoveredJob): JobOptions {
  const config = job.config

  return {
    name: config.name,
    queue: config.queue,
    tries: config.tries,
    backoff: config.backoff,
    timeout: config.timeout,
    backoffConfig: config.backoffConfig,
    rate: config.rate,
  }
}
