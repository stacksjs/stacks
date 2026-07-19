import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { diffSnapshots, diffSnapshotsDetailed, snapshotTree } from '../src/upgrade/framework-utils'

// Regression coverage for stacksjs/stacks#1988: `buddy upgrade --dry-run`
// used to sync framework files, rewrite .stacks-version, replace buddy, run
// bun install, and run migrations. The flag was delivered to the action
// layer (`--dryRun` visible in the delegated invocation) but the vendored
// framework upgrade action never read it. These tests pin both sides:
// dry-run writes nothing and lists the changes, and a run without
// --dry-run still performs the sync.

const script = join(import.meta.dir, '..', 'src', 'upgrade', 'framework.ts')

let baseDir: string
let appDir: string
let checkoutDir: string

function write(rel: string, content: string, root: string): void {
  const abs = join(root, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

beforeEach(() => {
  baseDir = join(tmpdir(), `stacks-dry-run-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  appDir = join(baseDir, 'app')
  checkoutDir = join(baseDir, 'checkout')

  // Fixture app: a minimal vendored-core layout on version 0.70.112.
  write('storage/framework/core/buddy/package.json', JSON.stringify({ name: '@stacksjs/buddy', version: '0.70.112' }), appDir)
  write('storage/framework/core/old-file.ts', 'old content', appDir)
  write('buddy', 'old buddy', appDir)
  write('bootstrap', 'old bootstrap', appDir)

  // Fixture stacks checkout: version 0.70.113 with one changed file,
  // one added file, and newer root scripts.
  write('storage/framework/core/buddy/package.json', JSON.stringify({ name: '@stacksjs/buddy', version: '0.70.113' }), checkoutDir)
  write('storage/framework/core/old-file.ts', 'new content', checkoutDir)
  write('storage/framework/core/new-file.ts', 'brand new', checkoutDir)
  write('buddy', 'new buddy', checkoutDir)
  write('bootstrap', 'new bootstrap', checkoutDir)
})

afterEach(() => {
  try {
    if (existsSync(baseDir))
      rmSync(baseDir, { recursive: true, force: true })
  }
  catch {}
})

async function runUpgradeScript(args: string[]): Promise<{ code: number, stdout: string, stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, script, ...args],
    cwd: appDir,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, stdout, stderr }
}

describe('diffSnapshotsDetailed', () => {
  it('returns the sorted file lists behind the counts', async () => {
    const dir = join(baseDir, 'detail')
    write('keep.txt', 'same', dir)
    write('change.txt', 'before', dir)
    write('remove.txt', 'gone', dir)

    const before = await snapshotTree(dir)
    write('change.txt', 'after', dir)
    write('add.txt', 'new', dir)
    rmSync(join(dir, 'remove.txt'))
    const after = await snapshotTree(dir)

    const summary = diffSnapshotsDetailed(before, after)
    expect(summary.added).toBe(1)
    expect(summary.changed).toBe(1)
    expect(summary.removed).toBe(1)
    expect(summary.unchanged).toBe(1)
    expect(summary.addedFiles).toEqual(['add.txt'])
    expect(summary.changedFiles).toEqual(['change.txt'])
    expect(summary.removedFiles).toEqual(['remove.txt'])
  })
})

describe('buddy upgrade --dry-run (framework sync)', () => {
  it('writes nothing and lists what would change', async () => {
    const before = await snapshotTree(appDir)

    const { code, stdout, stderr } = await runUpgradeScript(['--from', checkoutDir, '--dryRun', '--force'])

    expect(stderr).toBe('')
    expect(code).toBe(0)

    // The preview lists the changes...
    expect(stdout).toContain('DRY RUN')
    expect(stdout).toContain('version: v0.70.112 -> v0.70.113')
    expect(stdout).toContain('+ new-file.ts')
    expect(stdout).toContain('~ old-file.ts')
    expect(stdout).toContain('would update') // buddy / bootstrap
    expect(stdout).toContain('A real run would:')
    expect(stdout).toContain('.stacks-channel')
    expect(stdout).toContain('No changes were made.')

    // ...and the fixture is byte-identical afterwards.
    const after = await snapshotTree(appDir)
    const drift = diffSnapshots(before, after)
    expect(drift.added).toBe(0)
    expect(drift.changed).toBe(0)
    expect(drift.removed).toBe(0)

    // Spot-check the exact side effects from the bug report.
    expect(existsSync(join(appDir, '.stacks-version'))).toBe(false)
    expect(existsSync(join(appDir, '.stacks-channel'))).toBe(false)
    expect(existsSync(join(appDir, 'storage/framework/core/new-file.ts'))).toBe(false)
    expect(readFileSync(join(appDir, 'storage/framework/core/old-file.ts'), 'utf-8')).toBe('old content')
    expect(readFileSync(join(appDir, 'buddy'), 'utf-8')).toBe('old buddy')
    expect(JSON.parse(readFileSync(join(appDir, 'storage/framework/core/buddy/package.json'), 'utf-8')).version).toBe('0.70.112')
  }, 15000)

  it('still performs the full sync when --dry-run is absent', async () => {
    const { code, stdout } = await runUpgradeScript(['--from', checkoutDir, '--force', '--noPostinstall'])

    expect(code).toBe(0)
    expect(stdout).toContain('Upgraded Stacks from v0.70.112 to v0.70.113')

    expect(readFileSync(join(appDir, 'storage/framework/core/new-file.ts'), 'utf-8')).toBe('brand new')
    expect(readFileSync(join(appDir, 'storage/framework/core/old-file.ts'), 'utf-8')).toBe('new content')
    expect(readFileSync(join(appDir, 'buddy'), 'utf-8')).toBe('new buddy')
    expect(readFileSync(join(appDir, 'bootstrap'), 'utf-8')).toBe('new bootstrap')
    expect(JSON.parse(readFileSync(join(appDir, 'storage/framework/core/buddy/package.json'), 'utf-8')).version).toBe('0.70.113')
    expect(readFileSync(join(appDir, '.stacks-channel'), 'utf-8')).toBe('stable')
  }, 15000)
})
