import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDowngrade } from '../src/upgrade/packages'

// stacksjs/stacks#3011: `buddy upgrade` pinned an app's STX 0.2.706 back to
// the 0.2.691 its target release declared, and printed the six downgrades in
// the same list of arrows as the upgrades. The app lost every recycled list,
// and three hours went on other causes before `git diff package.json`.

describe('isDowngrade', () => {
  it('compares the versions under their range operators', () => {
    expect(isDowngrade('0.2.706', '0.2.691')).toBe(true)
    expect(isDowngrade('^0.2.706', '^0.2.691')).toBe(true)
    expect(isDowngrade('0.2.691', '0.2.706')).toBe(false)
    expect(isDowngrade('^0.75.300', '^0.75.318')).toBe(false)
    expect(isDowngrade('0.2.706', '0.2.706')).toBe(false)
    expect(isDowngrade('1.0.0', '1.0.0-beta.2')).toBe(true)
    expect(isDowngrade('1.0.0-beta.2', '1.0.0')).toBe(false)
  })

  it('never calls a reference that is not a plain version a downgrade', () => {
    expect(isDowngrade('workspace:*', '^0.75.318')).toBe(false)
    expect(isDowngrade('file:../stx', '0.2.691')).toBe(false)
    expect(isDowngrade('latest', '0.2.691')).toBe(false)
  })
})

describe('buddy upgrade and a release that declares older versions (#3011)', () => {
  const fixture = join(import.meta.dir, 'fixtures', 'upgrade-downgrade.ts')
  let app: string

  function manifest(stx: string): string {
    return `${JSON.stringify({
      name: 'app',
      dependencies: { 'stacks': '0.75.318', '@stacksjs/stx': stx, '@stacksjs/components': stx },
      overrides: { '@stacksjs/stx': stx },
    }, null, 2)}\n`
  }

  /** The fields an upgrade pins, so a project-manifest migration beside them does not matter. */
  function pins(): unknown {
    const { dependencies, overrides } = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
    return { dependencies, overrides }
  }
  function expected(stx: string): unknown {
    const { dependencies, overrides } = JSON.parse(manifest(stx))
    return { dependencies, overrides }
  }

  async function upgrade(...flags: string[]): Promise<{ code: number, out: string }> {
    const stdout = join(app, '.stdout')
    const stderr = join(app, '.stderr')
    const child = Bun.spawn([process.execPath, '--no-env-file', fixture, ...flags], { cwd: app, stdout: Bun.file(stdout), stderr: Bun.file(stderr) })
    const code = await child.exited
    const read = (path: string): string => existsSync(path) ? readFileSync(path, 'utf8') : ''
    return { code, out: `${read(stdout)}${read(stderr)}` }
  }

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), 'stacks-upgrade-downgrade-'))
  })
  afterEach(() => rmSync(app, { recursive: true, force: true }))

  it('refuses by default, names the release that wanted it, and writes nothing', async () => {
    writeFileSync(join(app, 'package.json'), manifest('0.2.706'))
    // A vendored manifest ahead of the release too: it used to be rewritten
    // before anything was reported, so a refusal has to happen before that.
    const vendored = join(app, 'storage/framework/defaults/build/package.json')
    const ahead = `${JSON.stringify({ dependencies: { '@stacksjs/actions': '^0.75.330' } }, null, 2)}\n`
    mkdirSync(join(vendored, '..'), { recursive: true })
    writeFileSync(vendored, ahead)
    const { code, out } = await upgrade()
    expect(code).toBe(1)
    expect(out).toContain('because stacks@0.75.318 declares older versions than this app does')
    expect(out).toMatch(/@stacksjs\/stx\s+0\.2\.706 {2}→ {2}0\.2\.691 {3}\(downgrade\)/)
    expect(out).toMatch(/@stacksjs\/stx \(overrides\)\s+0\.2\.706 {2}→ {2}0\.2\.691 {3}\(downgrade\)/)
    expect(out).toMatch(/@stacksjs\/actions\s+\^0\.75\.330 {2}→ {2}\^0\.75\.318 {3}\(downgrade\) {3}storage\/framework\/defaults\/build\/package\.json/)
    expect(out).toContain('Refusing to downgrade 4 dependencies. Nothing was written or installed.')
    expect(out).toContain('--allow-downgrade')
    // Not listed as an update as well.
    expect(out).not.toContain('will be updated')
    expect(readFileSync(join(app, 'package.json'), 'utf8')).toBe(manifest('0.2.706'))
    expect(readFileSync(vendored, 'utf8')).toBe(ahead)
  })

  it('shows the downgrade in a preview and says a real run would refuse it', async () => {
    writeFileSync(join(app, 'package.json'), manifest('0.2.706'))
    const { code, out } = await upgrade('--dry-run')
    expect(code).toBe(0)
    expect(out).toContain('would be downgraded')
    expect(out).toContain('A real run refuses this upgrade unless --allow-downgrade is passed.')
    expect(readFileSync(join(app, 'package.json'), 'utf8')).toBe(manifest('0.2.706'))
  })

  it('applies it when --allow-downgrade asks for it, still marked as one', async () => {
    writeFileSync(join(app, 'package.json'), manifest('0.2.706'))
    const { code, out } = await upgrade('--allow-downgrade')
    expect(code).toBe(0)
    expect(out).toContain('will be downgraded')
    expect(pins()).toEqual(expected('0.2.691'))
  })

  it('treats the same release as an ordinary upgrade for an app that is behind it', async () => {
    writeFileSync(join(app, 'package.json'), manifest('0.2.680'))
    const { code, out } = await upgrade()
    expect(code).toBe(0)
    expect(out).toContain('will be updated')
    expect(out).not.toContain('downgrade')
    expect(pins()).toEqual(expected('0.2.691'))
  })
})
