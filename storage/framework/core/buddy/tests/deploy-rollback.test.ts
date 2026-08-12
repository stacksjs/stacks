import { describe, expect, it } from 'bun:test'
import { runDeployRollback } from '../src/commands/deploy'

describe('deploy rollback', () => {
  it('delegates rollback previews to the native ts-cloud command', async () => {
    let invoked: string[] = []
    const exitCode = await runDeployRollback('dashboard', {
      env: 'staging',
      to: 'release-42',
      dryRun: true,
      verbose: true,
    }, async (command) => {
      invoked = command
      return 0
    })

    expect(exitCode).toBe(0)
    expect(invoked[0]).toBe(process.execPath)
    expect(invoked[1]).toEndWith('/@stacksjs/ts-cloud/dist/bin/cli.js')
    expect(invoked.slice(2)).toEqual([
      'deploy:rollback',
      'dashboard',
      '--env',
      'staging',
      '--to',
      'release-42',
      '--dry-run',
      '--verbose',
    ])
  })

  it('defaults to production and preserves the native previous-release behavior', async () => {
    let invoked: string[] = []
    await runDeployRollback(undefined, {}, async (command) => {
      invoked = command
      return 0
    })

    expect(invoked.slice(2)).toEqual(['deploy:rollback', '--env', 'production'])
  })
})
