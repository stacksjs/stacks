import { describe, expect, it } from 'bun:test'
import { runPostSyncMigration } from '../src/upgrade/framework-hooks'

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
