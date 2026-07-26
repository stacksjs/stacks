import { describe, expect, it } from 'bun:test'
import {
  detectDependencyInstaller,
  resolveDependencyRefreshCommand,
  resolvePantryExecutable,
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
  it('forces the installer to fully resolve the upgraded workspace graph', async () => {
    let received: Parameters<Parameters<typeof runPostSyncDependencyRefresh>[0]['spawn']>[0] | undefined

    await runPostSyncDependencyRefresh({
      cmd: ['/opt/bun', 'install', '--force'],
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
      cmd: ['bun', 'install', '--force'],
      projectRoot: '/app',
      spawn: () => ({ exited: Promise.resolve(9) }),
    })

    await expect(refresh).rejects.toThrow('Post-upgrade dependency refresh exited with code 9.')
  })
})

describe('vendored upgrade installer selection', () => {
  it('hands a pantry app to pantry, because node_modules is not what it resolves', () => {
    expect(detectDependencyInstaller(true)).toBe('pantry')
    expect(detectDependencyInstaller(false)).toBe('bun')
  })

  it('builds the refresh argv for whichever installer owns the graph', () => {
    expect(resolveDependencyRefreshCommand({
      installer: 'bun',
      bunExecutable: '/opt/bun',
      pantryExecutable: '/usr/local/bin/pantry',
    })).toEqual(['/opt/bun', 'install', '--force'])

    expect(resolveDependencyRefreshCommand({
      installer: 'pantry',
      bunExecutable: '/opt/bun',
      pantryExecutable: '/usr/local/bin/pantry',
    })).toEqual(['/usr/local/bin/pantry', 'install', '--force'])
  })

  it('prefers the project-local pantry over anything installed globally', () => {
    const present = new Set(['/app/pantry/.bin/pantry', '/home/me/.local/bin/pantry'])

    expect(resolvePantryExecutable(
      ['/app/pantry/.bin/pantry', '/home/me/.local/bin/pantry'],
      path => present.has(path),
    )).toBe('/app/pantry/.bin/pantry')
  })

  it('skips candidates that are not installed', () => {
    const present = new Set(['/home/me/.local/bin/pantry'])

    expect(resolvePantryExecutable(
      ['/app/pantry/.bin/pantry', '/home/me/.local/bin/pantry'],
      path => present.has(path),
    )).toBe('/home/me/.local/bin/pantry')
  })

  it('falls back to a PATH lookup when no candidate exists', () => {
    expect(resolvePantryExecutable(['/nope/pantry'], () => false)).toBe('pantry')
    expect(resolvePantryExecutable([], () => false)).toBe('pantry')
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
