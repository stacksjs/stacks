import { describe, expect, it } from 'bun:test'
import {
  runPostSyncDependencyRefresh,
  runPostSyncMigration,
  shouldRefreshPostSyncDependencies,
  shouldRunPostSyncHooks,
} from '../src/upgrade/framework-hooks'

describe('vendored upgrade post-sync hook scheduling', () => {
  it('runs deferred hooks after an internal restart even when the new process sees no diff', () => {
    expect(shouldRunPostSyncHooks(0, true)).toBe(true)
    expect(shouldRefreshPostSyncDependencies(false, true)).toBe(true)
  })

  it('keeps genuine no-op upgrades fast when no restart occurred', () => {
    expect(shouldRunPostSyncHooks(0, false)).toBe(false)
    expect(shouldRefreshPostSyncDependencies(false, false)).toBe(false)
  })

  it('runs hooks and dependency refreshes for changes detected in the current process', () => {
    expect(shouldRunPostSyncHooks(1, false)).toBe(true)
    expect(shouldRefreshPostSyncDependencies(true, false)).toBe(true)
  })
})

describe('vendored upgrade post-sync dependency refresh', () => {
  it('forces Bun to fully resolve the upgraded workspace graph', async () => {
    let received: Parameters<Parameters<typeof runPostSyncDependencyRefresh>[0]['spawn']>[0] | undefined

    await runPostSyncDependencyRefresh({
      bunExecutable: '/opt/bun',
      projectRoot: '/app',
      spawn: (options) => {
        received = options
        return { exited: Promise.resolve(0) }
      },
    })

    expect(received).toEqual({
      cmd: ['/opt/bun', 'install', '--force'],
      cwd: '/app',
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  })

  it('reports a failed dependency refresh to the upgrade hook', async () => {
    const refresh = runPostSyncDependencyRefresh({
      bunExecutable: 'bun',
      projectRoot: '/app',
      spawn: () => ({ exited: Promise.resolve(9) }),
    })

    await expect(refresh).rejects.toThrow('Post-upgrade dependency refresh exited with code 9.')
  })
})

describe('vendored upgrade post-sync migration', () => {
  it('runs without stdin and forces the nested migration past confirmation', async () => {
    let received: Parameters<Parameters<typeof runPostSyncMigration>[0]['spawn']>[0] | undefined

    await runPostSyncMigration({
      bunExecutable: '/opt/bun',
      migrateScript: '/app/storage/framework/core/buddy/src/cli.ts',
      projectRoot: '/app',
      spawn: (options) => {
        received = options
        return { exited: Promise.resolve(0) }
      },
    })

    expect(received).toEqual({
      cmd: [
        '/opt/bun',
        '/app/storage/framework/core/buddy/src/cli.ts',
        'migrate',
        '--force',
      ],
      cwd: '/app',
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  })

  it('propagates a failed migration to the upgrade command', async () => {
    const migration = runPostSyncMigration({
      bunExecutable: 'bun',
      migrateScript: '/app/buddy.ts',
      projectRoot: '/app',
      spawn: () => ({ exited: Promise.resolve(7) }),
    })

    await expect(migration).rejects.toThrow('Post-upgrade migration exited with code 7.')
  })
})
