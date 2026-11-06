import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import type { TrackedWorker } from './events'

export interface WorkerSnapshot {
  worker: TrackedWorker
  heartbeatAt: number
  activeJobs: number
  metrics: {
    completed: number
    failed: number
    throughputPerMinute: number
    averageDuration: number
  }
}

export const WORKER_STALE_MS = 60_000
export const WORKER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

/** One upsert per worker heartbeat, never a read/modify/write shared counter. */
export async function persistWorkerSnapshot(snapshot: WorkerSnapshot): Promise<void> {
  const dialect = sqlHelpers(getDatabaseDialect())
  const values = [snapshot.worker.id, JSON.stringify(snapshot), snapshot.heartbeatAt]
  const columns = ['worker_id', 'snapshot', 'heartbeat_at']
  const quote = (name: string) => dialect.isMysql ? `\`${name}\`` : `"${name}"`
  const update = ['snapshot', 'heartbeat_at'].map(column => dialect.isMysql
    ? `${quote(column)} = VALUES(${quote(column)})`
    : `${quote(column)} = excluded.${quote(column)}`).join(', ')
  await db.unsafe(`INSERT INTO queue_workers (${columns.map(quote).join(', ')}) VALUES (${values.map((_, i) => dialect.param(i + 1)).join(', ')}) ${dialect.isMysql ? 'ON DUPLICATE KEY UPDATE' : 'ON CONFLICT (worker_id) DO UPDATE SET'} ${update}`, values).execute()
}

export async function pruneWorkerSnapshots(now = Date.now()): Promise<void> {
  const dialect = sqlHelpers(getDatabaseDialect())
  await db.unsafe(`DELETE FROM queue_workers WHERE heartbeat_at < ${dialect.param(1)}`, [now - WORKER_RETENTION_MS]).execute()
}

/** A stale or stopped worker never appears to be processing work. */
export function workerSnapshotState(snapshot: WorkerSnapshot, now = Date.now()): WorkerSnapshot {
  if (snapshot.worker.status === 'stopped' || now - snapshot.heartbeatAt > WORKER_STALE_MS) {
    return { ...snapshot, worker: { ...snapshot.worker, status: 'stopped' }, activeJobs: 0,
      metrics: { ...snapshot.metrics, throughputPerMinute: 0, averageDuration: 0 } }
  }
  return snapshot
}

export async function readWorkerSnapshots(now = Date.now()): Promise<WorkerSnapshot[]> {
  const dialect = sqlHelpers(getDatabaseDialect())
  const rows = await db.unsafe(`SELECT snapshot FROM queue_workers WHERE heartbeat_at >= ${dialect.param(1)} ORDER BY heartbeat_at DESC`, [now - WORKER_RETENTION_MS]).execute() as Array<{ snapshot: string }>
  return rows.map(row => workerSnapshotState(JSON.parse(row.snapshot) as WorkerSnapshot, now))
}

export function aggregateWorkerMetrics(snapshots: WorkerSnapshot[]) {
  const throughputPerMinute = snapshots.reduce((sum, value) => sum + value.metrics.throughputPerMinute, 0)
  return {
    counts: {
      completed: snapshots.reduce((sum, value) => sum + value.metrics.completed, 0),
      failed: snapshots.reduce((sum, value) => sum + value.metrics.failed, 0),
    },
    throughputPerMinute,
    averageDuration: throughputPerMinute > 0
      ? snapshots.reduce((sum, value) => sum + value.metrics.averageDuration * value.metrics.throughputPerMinute, 0) / throughputPerMinute : 0,
  }
}
