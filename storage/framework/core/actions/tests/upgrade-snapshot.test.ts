import { describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diffSnapshots, snapshotTree } from '../src/upgrade/framework-utils'

// Pin the hash-based diff. Pre-fix, the snapshot was keyed on size+mtime,
// so `cpSync` (which always touches mtimes) made every no-op upgrade
// report ~1600 changed files. Switching to xxh3 content hashes produced
// real "no-op = 0 changed" output. These tests guard that contract.

function makeFixture(): string {
  const dir = join(tmpdir(), `stacks-upgrade-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'a.txt'), 'alpha')
  writeFileSync(join(dir, 'b.txt'), 'beta')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub/c.txt'), 'gamma')
  return dir
}

describe('snapshotTree + diffSnapshots', () => {
  it('reports 0 changed when content is identical (mtime touched, bytes same)', async () => {
    const dir = makeFixture()
    try {
      const before = await snapshotTree(dir)
      // Touch every file so mtime changes but bytes don't.
      const now = new Date()
      writeFileSync(join(dir, 'a.txt'), 'alpha')
      writeFileSync(join(dir, 'b.txt'), 'beta')
      writeFileSync(join(dir, 'sub/c.txt'), 'gamma')
      void now
      const after = await snapshotTree(dir)
      const summary = diffSnapshots(before, after)
      expect(summary.added).toBe(0)
      expect(summary.changed).toBe(0)
      expect(summary.removed).toBe(0)
      expect(summary.unchanged).toBe(3)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports added when a new file appears', async () => {
    const dir = makeFixture()
    try {
      const before = await snapshotTree(dir)
      writeFileSync(join(dir, 'd.txt'), 'delta')
      const after = await snapshotTree(dir)
      const summary = diffSnapshots(before, after)
      expect(summary.added).toBe(1)
      expect(summary.changed).toBe(0)
      expect(summary.removed).toBe(0)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports changed when content actually changes', async () => {
    const dir = makeFixture()
    try {
      const before = await snapshotTree(dir)
      writeFileSync(join(dir, 'a.txt'), 'alpha-modified')
      const after = await snapshotTree(dir)
      const summary = diffSnapshots(before, after)
      expect(summary.changed).toBe(1)
      expect(summary.unchanged).toBe(2)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports removed when a file disappears', async () => {
    const dir = makeFixture()
    try {
      const before = await snapshotTree(dir)
      rmSync(join(dir, 'b.txt'))
      const after = await snapshotTree(dir)
      const summary = diffSnapshots(before, after)
      expect(summary.removed).toBe(1)
      expect(summary.unchanged).toBe(2)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('honors skip[]', async () => {
    const dir = makeFixture()
    try {
      writeFileSync(join(dir, 'ignored.lock'), 'should-be-skipped')
      const snap = await snapshotTree(dir, ['ignored.lock'])
      expect([...snap.keys()]).not.toContain('ignored.lock')
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
