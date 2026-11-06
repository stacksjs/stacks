import { describe, expect, test } from 'bun:test'
import type { WorkerSnapshot } from '@stacksjs/queue'
import { readDashboardWorkerSnapshots } from './worker-snapshots'

/**
 * Worker heartbeats are telemetry beside the jobs. A missing `queue_workers`
 * table must leave the Queue and Jobs pages their counts; any other failure
 * must still fail them.
 */
describe('readDashboardWorkerSnapshots', () => {
  test('reads the heartbeats when the table exists, without asking the catalog', async () => {
    const snapshot = { worker: { id: 'w1' } } as unknown as WorkerSnapshot
    const read = await readDashboardWorkerSnapshots(async () => [snapshot], async () => { throw new Error('the catalog must not be asked') })
    expect(read).toEqual({ snapshots: [snapshot], migrated: true })
  })

  test('a missing queue_workers table answers no workers and migrated: false', async () => {
    const asked: string[] = []
    const read = await readDashboardWorkerSnapshots(
      async () => { throw new Error('relation "queue_workers" does not exist') },
      async (table) => { asked.push(table); return true },
    )
    expect(read).toEqual({ snapshots: [], migrated: false })
    expect(asked).toEqual(['queue_workers'])
  })

  test('any other failure is rethrown', async () => {
    const outage = new Error('connection refused')
    await expect(readDashboardWorkerSnapshots(async () => { throw outage }, async () => false)).rejects.toBe(outage)
  })
})
