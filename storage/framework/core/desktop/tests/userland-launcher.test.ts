import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * An application supplying its own desktop launcher.
 *
 * The framework launcher opens a Craft window on a URL baked into
 * `desktop.json`, which suits a hosted Stacks app and rules out a local-first
 * one — a disk cleaner, a log viewer, anything whose subject is the machine it
 * runs on. Those start something locally and open a window on that, and the
 * port is not known until launch.
 *
 * Before `app/Desktop/launcher.ts` was honoured, such an app had no way to use
 * `buddy build:desktop` at all and had to reimplement the packaging outside the
 * framework — which is exactly the kind of thing `app/` overrides exist to
 * prevent.
 */

const scratch: string[] = []

function project(withLauncher: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-launcher-'))
  scratch.push(root)
  if (withLauncher) {
    mkdirSync(join(root, 'app/Desktop'), { recursive: true })
    writeFileSync(join(root, 'app/Desktop/launcher.ts'), '// this app opens something local\n')
  }
  return root
}

afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('hasUserlandDesktopLauncher', () => {
  test('sees an app/Desktop/launcher.ts', async () => {
    const { hasUserlandDesktopLauncher } = await import('../src/index')
    expect(hasUserlandDesktopLauncher(project(true))).toBe(true)
  })

  test('reports none for a project without one', async () => {
    const { hasUserlandDesktopLauncher } = await import('../src/index')
    expect(hasUserlandDesktopLauncher(project(false))).toBe(false)
  })
})

describe('resolveDesktopLauncher', () => {
  test('prefers the application launcher over the framework one', async () => {
    const { resolveDesktopLauncher } = await import('../src/index')
    const root = project(true)
    expect(resolveDesktopLauncher(root)).toBe(join(root, 'app/Desktop/launcher.ts'))
  })

  test('falls back to the framework launcher when the app has none', async () => {
    const { resolveDesktopLauncher } = await import('../src/index')
    const resolved = resolveDesktopLauncher(project(false))

    expect(resolved).not.toContain('app/Desktop')
    // Either spelling is correct: the source inside this monorepo, or the
    // compiled file a consumer app installs.
    expect(resolved.endsWith('launcher.ts') || resolved.endsWith('launcher.js')).toBe(true)
  })

  test('still resolves when given no project root at all', async () => {
    const { resolveDesktopLauncher } = await import('../src/index')
    expect(typeof resolveDesktopLauncher()).toBe('string')
  })
})

describe('desktopLauncherCompileArgs', () => {
  // Compiles a real launcher and starts it from a directory whose bunfig.toml
  // preloads a package that does not exist and whose .env sets a variable -
  // an app's project directory, in miniature. The launcher must ignore both.
  test('a compiled launcher ignores the bunfig.toml and .env of its working directory', async () => {
    const { desktopLauncherCompileArgs } = await import('../src/index')
    const root = project(false)
    const entry = join(root, 'launcher.ts')
    const outfile = join(root, 'launcher-bin')
    writeFileSync(entry, 'console.log(`ran:${process.env.FROM_CWD_DOTENV ?? "clean"}`)\n')

    const build = Bun.spawnSync([process.execPath, ...desktopLauncherCompileArgs({ entry, outfile, minify: false })])
    expect(build.exitCode).toBe(0)

    const cwd = join(root, 'app-project')
    mkdirSync(cwd)
    writeFileSync(join(cwd, 'bunfig.toml'), 'preload = ["@stacksjs/not-installed/plugin.js"]\n')
    writeFileSync(join(cwd, '.env'), 'FROM_CWD_DOTENV=leaked\n')

    const run = Bun.spawnSync([outfile], { cwd, env: { PATH: process.env.PATH, HOME: process.env.HOME } })
    expect(run.stderr.toString()).not.toContain('preload not found')
    expect(run.stdout.toString().trim()).toBe('ran:clean')
    expect(run.exitCode).toBe(0)
  }, 60_000)
})
