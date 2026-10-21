import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { FEATURE_FILES } from '../src/commands/features'

/**
 * `<feature>:install` activates a feature. It does not vendor it.
 *
 * `dashboard:install` used to copy 778 files and 14 paths of framework code
 * into the application, and none of it had to be there: actions and models
 * resolve through the documented `app/` -> `storage/framework/defaults/app/`
 * override chain, components through the resolved component root, and routes
 * through `bootstrap.ts`, which registers them with `frameworkPath()` when
 * `mounts(feature)` is true. Copying is what lets you edit those files, not
 * what lets them run - and a copy shadows the defaults tree `buddy upgrade`
 * syncs, so upstream fixes stopped arriving with nothing to indicate it.
 *
 * Measured in the framework checkout, which has no userland dashboard copies:
 * `buddy route:list` reports 322 `/api/dashboard/` routes with
 * `config/dashboard.ts` `enabled: true`, and 0 with it `false`. The flag is
 * what mounts the feature.
 *
 * See stacksjs/stacks#2920.
 */

const root = join(import.meta.dir, '../../../../..')
const cli = join(root, 'storage/framework/core/buddy/src/cli.ts')

describe('<feature>:install does not copy the feature into userland', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'feature-install-'))
    mkdirSync(join(dir, 'storage/framework'), { recursive: true })
    symlinkSync(join(root, 'storage/framework/defaults'), join(dir, 'storage/framework/defaults'), 'dir')
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
    mkdirSync(join(dir, 'config'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{}\n')
    writeFileSync(join(dir, 'bunfig.toml'), 'preload = []\n')
    writeFileSync(join(dir, 'config/dashboard.ts'), 'export default {\n  enabled: false,\n}\n')
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function run(...args: string[]): { exitCode: number, output: string } {
    const result = Bun.spawnSync([process.execPath, `--config=${join(dir, 'bunfig.toml')}`, '--no-env-file', cli, ...args], {
      cwd: dir,
      // Every value passed explicitly, empty ones included: the env preload
      // refills deleted variables from the checkout's own .env.
      env: {
        ...process.env,
        APP_ENV: 'test',
        // This fixture tests feature installation in an initialized app. Do
        // not inherit a real key or invoke key generation without an env file.
        APP_KEY: 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: join(dir, 'db.sqlite'),
        CI: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    return { exitCode: result.exitCode ?? 1, output: `${result.stdout}${result.stderr}` }
  }

  /** Which of the feature's manifest paths exist in the throwaway project. */
  function landed(feature: 'dashboard'): string[] {
    return FEATURE_FILES[feature].filter(rel => existsSync(join(dir, rel)))
  }

  /**
   * Every real file in the throwaway project, as paths relative to it.
   *
   * `landed()` above only looks at the 14 manifest paths, so it cannot see a
   * regression that writes somewhere the manifest does not name. This walks
   * the whole project instead, which is the shape of the actual requirement:
   * activating a feature should change about as much as installing Nova or
   * Filament does - a config file, not a vendored tree.
   *
   * The two symlinks to the framework checkout (`storage/framework/defaults`
   * and `node_modules`) are skipped rather than followed: they are the
   * framework, not the application, and descending into them would count
   * every file in the repository.
   */
  function projectFiles(d: string = dir, prefix = ''): string[] {
    const out: string[] = []
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isSymbolicLink())
        continue
      if (entry.isDirectory())
        out.push(...projectFiles(join(d, entry.name), rel))
      else out.push(rel)
    }
    return out
  }

  function flag(): string {
    return readFileSync(join(dir, 'config/dashboard.ts'), 'utf8')
  }

  it('enables the feature and writes no feature files', () => {
    expect(landed('dashboard')).toEqual([])

    const { exitCode, output } = run('dashboard:install')
    expect(exitCode, output).toBe(0)
    expect(flag()).toContain('enabled: true')

    // The whole point: 14 manifest paths, none of them copied.
    expect(landed('dashboard')).toEqual([])
    expect(output).toContain('Runs from the framework defaults')
  }, 120_000)

  it('still copies them when --publish-all is asked for', () => {
    const { exitCode, output } = run('dashboard:install', '--publish-all')
    expect(exitCode, output).toBe(0)
    expect(flag()).toContain('enabled: true')

    // The escape hatch has to actually work, or this change just removes a
    // capability. `routes/dashboard.ts` is a file entry and
    // `resources/components/Dashboard/` a directory entry, so this covers both.
    const copied = landed('dashboard')
    expect(copied.length).toBeGreaterThan(0)
    expect(copied).toContain('routes/dashboard.ts')
    expect(copied).toContain('resources/components/Dashboard/')
  }, 120_000)

  /**
   * The requirement in the terms it was asked in: activating the dashboard
   * must not produce hundreds of file changes.
   *
   * Asserted as an exact set rather than a budget, because the measured
   * answer is one modified config file and nothing else, and a budget of
   * "under ten" would quietly absorb nine files of drift. The control that
   * makes this green meaningful is the `--publish-all` case below: same
   * fixture, same walk, 791 files added.
   */
  it('activating the dashboard touches config/dashboard.ts and nothing else', () => {
    const before = projectFiles()

    const { exitCode, output } = run('dashboard:install')
    expect(exitCode, output).toBe(0)
    expect(flag()).toContain('enabled: true')

    const after = projectFiles()
    expect(after.filter(f => !before.includes(f))).toEqual([])
    expect(after.sort()).toEqual(before.sort())
  }, 120_000)

  /**
   * The control. Without this the test above is indistinguishable from a
   * command that silently did nothing at all, which is exactly how the
   * no-copy change could regress into a no-op install.
   */
  it('--publish-all is the case that does write hundreds of files', () => {
    const before = projectFiles()

    const { exitCode, output } = run('dashboard:install', '--publish-all')
    expect(exitCode, output).toBe(0)

    const added = projectFiles().filter(f => !before.includes(f))
    expect(added.length).toBeGreaterThan(500)
    expect(added).toContain('routes/dashboard.ts')
  }, 120_000)

  it('a dry run writes neither the flag nor any file', () => {
    const { exitCode, output } = run('dashboard:install', '--publish-all', '--dry-run')
    expect(exitCode, output).toBe(0)
    expect(output).toContain('Dry run')
    expect(flag()).toContain('enabled: false')
    expect(landed('dashboard')).toEqual([])
  }, 120_000)
})
