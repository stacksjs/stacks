import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { createCache } from '../src'

// Workers that boot together open the same new cache file together. Switching
// it to WAL needs the file to itself, and SQLite answers the loser with
// SQLITE_BUSY at once rather than waiting out busy_timeout, so one worker
// failed to start.

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('the SQLite cache driver opened by several processes', () => {
  it('starts every worker that opens a new file at the same instant', async () => {
    const fixture = join(import.meta.dir, 'fixtures', 'open-sqlite-cache.ts')

    for (let round = 0; round < 3; round++) {
      const dir = mkdtempSync(join(tmpdir(), 'stacks-sqlite-open-'))
      dirs.push(dir)
      const path = join(dir, 'cache.sqlite')
      const startAt = String(Date.now() + 1500)
      const workers = Array.from({ length: 6 }, (_, who) => Bun.spawn([process.execPath, fixture, path, String(who), startAt], { stdout: 'pipe', stderr: 'pipe' }))

      expect(await Promise.all(workers.map(worker => worker.exited))).toEqual([0, 0, 0, 0, 0, 0])

      const cache = createCache('sqlite', { path })
      expect((await cache.keys('opened:*')).sort()).toEqual(['opened:0', 'opened:1', 'opened:2', 'opened:3', 'opened:4', 'opened:5'])
      await cache.close?.()
    }
  }, 60_000)
})
