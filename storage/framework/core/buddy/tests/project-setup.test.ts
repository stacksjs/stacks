import { describe, expect, it } from 'bun:test'
import { FEATURE_NAMES } from '@stacksjs/features'
import { shouldSkipAppKeyCheck } from '../src/project-setup'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

it('unpublishes framework defaults without generating or replacing application secrets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-unpublish-secrets-'))
  const original = 'APP_NAME="Synthetic defaults migration"\n'
  try {
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'synthetic-defaults-migration', type: 'module', dependencies: { stacks: '*' } }))
    writeFileSync(join(root, 'bunfig.toml'), 'preload = []\n')
    writeFileSync(join(root, '.env'), original)
    symlinkSync(fileURLToPath(new URL('../../../../../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir')
    const child = Bun.spawn([process.execPath, '--no-env-file', fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'unpublish:defaults'], {
      cwd: root, env: { ...process.env, APP_ENV: 'test', APP_KEY: '' }, stdout: 'pipe', stderr: 'pipe',
    })
    const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, output + error).toBe(0)
    expect(readFileSync(join(root, '.env'), 'utf8') === original, 'framework packaging must leave the application environment unchanged').toBe(true)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 15_000)

describe('Buddy project setup guards', () => {
  it('runs package-only support installation without creating an application key', () => {
    expect(shouldSkipAppKeyCheck('support:install', { args: ['support:install', '--sdk-only'] })).toBe(true)
    expect(shouldSkipAppKeyCheck('support:install', { args: ['support:install', '--messenger'] })).toBe(false)
  })

  it('runs the machine-level commands without a project around them', () => {
    for (const command of ['projects', 'projects:scan', 'cd', 'daemon', 'daemon:status', 'dashboard'])
      expect(shouldSkipAppKeyCheck(command), command).toBe(true)
    // A command that works on a project's data still needs the project.
    expect(shouldSkipAppKeyCheck('queue:work')).toBe(false)
  })

  it('runs documentation tools without creating an application key', () => {
    expect(shouldSkipAppKeyCheck('docs:native-skills')).toBe(true)
    expect(shouldSkipAppKeyCheck('docs:native-skills:check')).toBe(true)
    expect(shouldSkipAppKeyCheck('docs:artifacts')).toBe(true)
  })

  it('releases repository metadata without creating an application key', () => {
    expect(shouldSkipAppKeyCheck('release')).toBe(true)
    expect(shouldSkipAppKeyCheck('release:patch')).toBe(true)
  })

  it('allows upgrades in package-only and partially initialized projects', () => {
    expect(shouldSkipAppKeyCheck('upgrade')).toBe(true)
    expect(shouldSkipAppKeyCheck('update')).toBe(true)
    expect(shouldSkipAppKeyCheck('upgrade:dependencies')).toBe(true)
  })

  it('links framework packages without creating application secrets', () => {
    expect(shouldSkipAppKeyCheck('link:core')).toBe(true)
    expect(shouldSkipAppKeyCheck('unlink:core')).toBe(true)
  })

  it('configures feature bundles without creating an unrelated runtime key', () => {
    for (const feature of FEATURE_NAMES) {
      expect(shouldSkipAppKeyCheck(`${feature}:install`)).toBe(true)
      expect(shouldSkipAppKeyCheck(`${feature}:uninstall`)).toBe(true)
    }
    expect(shouldSkipAppKeyCheck('marketing:send')).toBe(false)
  })

  it('retains initialization for commands that require an application', () => {
    expect(shouldSkipAppKeyCheck('dev')).toBe(false)
  })
})
