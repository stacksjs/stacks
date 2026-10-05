import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

/**
 * `domains:add <domain>` and `domains:remove <domain>` took one handler
 * argument, `options`. cac passes the positional first, so `options` was the
 * domain string: `domains:add` spread its characters into the options and
 * never passed a domain on, and `domains:remove` found no `.domain` on it and
 * fell back to `config.app.url` - removing the app's own DNS records instead
 * of the domain it was given.
 */
function run(...argv: string[]): { call: string, payload: any } {
  const result = Bun.spawnSync([process.execPath, join(import.meta.dir, 'fixtures/domains-commands.ts'), ...argv], {
    cwd: join(import.meta.dir, '../../../../..'),
    env: { ...process.env, APP_URL: 'my-app.example' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const line = result.stdout.toString().trim().split('\n').reverse().find(candidate => candidate.startsWith('{"call"'))
  if (!line)
    throw new Error(`no call recorded (exit ${result.exitCode})\n${result.stdout}\n${result.stderr}`)
  return JSON.parse(line)
}

describe('buddy domains commands', () => {
  it('removes the domain it was given, not the app\'s own', () => {
    const { call, payload } = run('domains:remove', 'other.example', '--yes')

    expect(call).toBe('runAction')
    expect(payload.options.domain).toBe('other.example')
    // No characters of the domain spread in as option keys.
    expect(Object.keys(payload.options)).not.toContain('0')
  }, 60_000)

  it('adds the domain it was given', () => {
    const { call, payload } = run('domains:add', 'new.example')

    expect(call).toBe('addDomain')
    expect(payload.options.domain).toBe('new.example')
    expect(Object.keys(payload.options)).not.toContain('0')
  }, 60_000)

  it('sends no contact defaults with a purchase, so the action\'s config wins', () => {
    const { payload } = run('domains:purchase', 'buy.example')

    expect(payload.options.domain).toBe('buy.example')
    for (const key of ['privacy', 'autoRenew', 'contactType', 'firstName', 'privacyAdmin'])
      expect(payload.options[key]).toBeUndefined()
  }, 60_000)

  it('forwards --no-privacy as a value the action reads back as false', () => {
    const { payload } = run('domains:purchase', 'buy.example', '--no-privacy', '--no-auto-renew')

    expect(payload.options.privacy).toBe('false')
    expect(payload.options.autoRenew).toBe('false')
  }, 60_000)
})
