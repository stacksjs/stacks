import type { LoadResult } from './drivers'
import { Database } from 'bun:sqlite'
import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DRIVERS } from './drivers'
import { createFixture } from './fixture'
import { verifyLoadPersistence } from './persistence'

it('distinguishes drained request counts from cancelled in-flight responses', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-load-persistence-'))
  const file = join(dir, 'bench.sqlite')
  const result: LoadResult = {
    requests: 2, errors: 0, rpsMean: 2, rpsP50: null,
    latencyMs: { p50: 1, p90: 1, p99: 1 }, raw: '',
  }
  try {
    createFixture(file)
    const db = new Database(file)
    try {
      const insert = db.prepare(`INSERT INTO query_logs (query, executed_at)
        VALUES ('SELECT id FROM bench_items', '2026-09-05T00:00:00')`)
      // Three SELECTs executed, but the third response can be cancelled at
      // the driver's deadline. Completed responses alone cannot prove excess logs.
      for (let i = 0; i < 3; i++) insert.run()
    }
    finally {
      db.close()
    }
    for (const name of ['autocannon', 'bombardier']) {
      const audit = await verifyLoadPersistence(file, DRIVERS.find(driver => driver.name === name)!, result, null)
      expect(audit.status).toBe('unverified')
      expect(audit).not.toHaveProperty('persistedQueries')
    }
    for (const name of ['oha', 'builtin']) {
      const driver = DRIVERS.find(driver => driver.name === name)!
      await expect(verifyLoadPersistence(file, driver, result, null)).rejects.toThrow('expected 2, found 3')
      const warmup = { ...result, requests: 1 }
      expect(await verifyLoadPersistence(file, driver, result, warmup)).toEqual({
        status: 'verified', warmupRequests: 1, measuredRequests: 2, persistedQueries: 3,
      })
      await expect(verifyLoadPersistence(file, driver, { ...result, errors: 1 }, warmup)).rejects.toThrow('failed or missing requests')
      await expect(verifyLoadPersistence(file, driver, result, { ...warmup, errors: 1 })).rejects.toThrow('failed or missing requests')
      await expect(verifyLoadPersistence(file, driver, { ...result, requests: 0 }, null)).rejects.toThrow('failed or missing requests')
    }
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
