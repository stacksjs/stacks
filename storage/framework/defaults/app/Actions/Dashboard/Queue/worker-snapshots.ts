import type { WorkerSnapshot } from '@stacksjs/queue'
import { readWorkerSnapshots } from '@stacksjs/queue'
import { isUnmigratedTable } from '../Models/model-migration'

/** Where workers publish their heartbeats (`app/Models/QueueWorker.ts`). */
export const WORKER_TABLE = 'queue_workers'

/**
 * The worker heartbeats, for the Queue and Jobs pages.
 *
 * Heartbeats are telemetry beside the jobs, not the jobs: the queue counts and
 * job totals come from `jobs` and `failed_jobs`, and a worker already runs
 * without its telemetry table ("Queue worker telemetry unavailable"). So an app
 * that has not migrated `queue_workers` gets its counts with no workers and
 * `migrated: false`, where all three endpoints used to answer 503 and take the
 * page's counts down with them.
 *
 * Only a missing table, as the catalog reports it, is treated that way. Any
 * other failure is rethrown.
 */
export async function readDashboardWorkerSnapshots(
  read: () => Promise<WorkerSnapshot[]> = readWorkerSnapshots,
  isMissing: (table: string) => Promise<boolean> = isUnmigratedTable,
): Promise<{ snapshots: WorkerSnapshot[], migrated: boolean }> {
  try {
    return { snapshots: await read(), migrated: true }
  }
  catch (error) {
    if (await isMissing(WORKER_TABLE))
      return { snapshots: [], migrated: false }
    throw error
  }
}
