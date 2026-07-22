/**
 * Per-job progress + cancellation tracking.
 *
 * Long-running jobs (CSV exports, image processing pipelines, batch
 * email sends) need to report progress so the UI can show a meaningful
 * progress bar — and they need to honor a cancellation request so
 * users can abort runs they no longer want.
 *
 * Both signals live in the cache layer (so they survive the worker
 * lifecycle and can be read from any process), keyed by the job id
 * the worker assigns at dispatch time. The keys are short-TTL'd
 * (1 hour) so cancelled-but-finished jobs don't leak forever.
 */

const PROGRESS_KEY = (jobId: string): string => `__job_progress__:${jobId}`
const CANCEL_KEY = (jobId: string): string => `__job_cancel__:${jobId}`
const TTL_SECONDS = 60 * 60

interface JobProgress {
  /** Percent complete, 0-100. Float for sub-percent precision (e.g. 12.5%). */
  percent: number
  /** Optional human-readable status — "Processing row 1234 of 5000". */
  message?: string
  /** Unix ms timestamp of the most recent update. */
  updatedAt: number
}

/**
 * Clamp a reported progress value to the `percent` contract (0-100).
 * Non-finite input (NaN/Infinity) reports 0.
 *
 * `percent` is a percent, not a fraction: `50` is 50%, `12.5` is 12.5%.
 * The previous implementation branched on the value (`v <= 1 ? v*100 : v`)
 * to also accept fractions, which made `setJobProgress(id, 1)` — a caller
 * meaning 1% — jump to 100%. Progress is single-contract now
 * (stacksjs/stacks#1984).
 */
export function clampProgressPercent(percent: number): number {
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
}

/**
 * Update the progress of the running job. Workers call this from
 * inside their handler; the UI polls `getJobProgress(id)` to render
 * a progress bar. `percent` is 0-100 (a percent, not a 0-1 fraction).
 *
 * @example
 * ```ts
 * await setJobProgress(job.id, 50, 'Halfway there')
 * // … later
 * await setJobProgress(job.id, 100, 'Done')
 * ```
 */
export async function setJobProgress(
  jobId: string,
  percent: number,
  message?: string,
): Promise<void> {
  const { cache } = await import('@stacksjs/cache')
  await cache.set(
    PROGRESS_KEY(jobId),
    { percent: clampProgressPercent(percent), message, updatedAt: Date.now() } as JobProgress,
    TTL_SECONDS,
  )
}

/**
 * Read the current progress of a job, or `null` if no progress has
 * been recorded yet (job hasn't started, or the entry expired).
 */
export async function getJobProgress(jobId: string): Promise<JobProgress | null> {
  const { cache } = await import('@stacksjs/cache')
  return (await cache.get<JobProgress>(PROGRESS_KEY(jobId))) ?? null
}

/**
 * Mark a job as cancelled. The next time the worker calls
 * `isJobCancelled(id)` it will see the flag and can stop cleanly. The
 * worker is responsible for checking — the framework can't preempt a
 * running handler safely.
 *
 * @example
 * ```ts
 * // From an admin endpoint:
 * await cancelJob(req.params.id)
 *
 * // Inside the worker:
 * if (await isJobCancelled(job.id)) return
 * ```
 */
export async function cancelJob(jobId: string): Promise<void> {
  const { cache } = await import('@stacksjs/cache')
  await cache.set(CANCEL_KEY(jobId), 1, TTL_SECONDS)
}

/**
 * Check whether the named job has been cancelled. Workers should call
 * this between unit-of-work iterations so cancellations are honored
 * promptly without preempting in-flight work.
 */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const { cache } = await import('@stacksjs/cache')
  return Boolean(await cache.get(CANCEL_KEY(jobId)))
}

/**
 * Clear progress + cancellation state for a finished job. Workers
 * should call this on completion (success or failure) so admin UIs
 * showing "in-flight jobs" don't keep finished entries forever.
 *
 * No-op if no entries exist for the id — safe to call always.
 */
export async function clearJobState(jobId: string): Promise<void> {
  const { cache } = await import('@stacksjs/cache')
  await Promise.all([
    cache.del(PROGRESS_KEY(jobId)),
    cache.del(CANCEL_KEY(jobId)),
  ])
}
