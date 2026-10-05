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
    }, '0.16.34')

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

  it('forwards --all and --only-if-live, for a failed deploy undoing itself', async () => {
    let invoked: string[] = []
    await runDeployRollback(undefined, { all: true, onlyIfLive: 'abc1234def' }, async (command) => {
      invoked = command
      return 0
    }, '0.16.34')

    expect(invoked.slice(2)).toEqual(['deploy:rollback', '--env', 'production', '--all', '--only-if-live', 'abc1234def'])
  })

  it('refuses a dry run that an older ts-cloud would carry out as a real rollback', async () => {
    let ran = false
    const exitCode = await runDeployRollback('main', { dryRun: true }, async () => {
      ran = true
      return 0
    }, '0.16.31')

    expect(ran).toBe(false)
    expect(exitCode).not.toBe(0)
  })

  it('refuses when the installed ts-cloud version cannot be read', async () => {
    let ran = false
    await runDeployRollback(undefined, { all: true }, async () => {
      ran = true
      return 0
    }, null)
    expect(ran).toBe(false)
  })

  it('still runs a plain rollback on any ts-cloud', async () => {
    let ran = false
    await runDeployRollback('main', {}, async () => {
      ran = true
      return 0
    }, '0.16.11')
    expect(ran).toBe(true)
  })
})
