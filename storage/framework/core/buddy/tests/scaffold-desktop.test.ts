import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveMacosDesktop, validateMacosDesktop } from '@stacksjs/desktop-build'
import { scaffoldTargetOccupants } from '../src/commands/create'
import { appIdentity } from '../src/scaffold-app'
import { DESKTOP_SCRIPTS, desktopScaffoldFiles, scaffoldDesktopApp } from '../src/scaffold-desktop'

/**
 * `buddy new <name> --desktop`: what it writes must be a desktop app the
 * build accepts as it stands, and must never overwrite what an app has.
 */

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function app(name = 'browser'): string {
  const root = join(mkdtempSync(join(tmpdir(), 'stacks-desktop-scaffold-')), name)
  dirs.push(join(root, '..'))
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name, scripts: { dev: './buddy dev' } }, null, 2)}\n`)
  return root
}

describe('scaffoldDesktopApp', () => {
  test('writes the config, a screen, the agent routes and the scripts', () => {
    const root = app()
    expect(scaffoldDesktopApp(root, appIdentity(root)).sort()).toEqual(['app/Desktop/Agent.ts', 'config/desktop.ts', 'package.json', 'resources/native/Main.stx'])
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.scripts).toEqual({ 'dev': './buddy dev', ...DESKTOP_SCRIPTS })
  })

  test('the config it writes is one the build accepts: an agent app with a Main screen', async () => {
    const root = app()
    scaffoldDesktopApp(root, appIdentity(root))
    const config = (await import(join(root, 'config/desktop.ts'))).default
    expect(config.macos).toMatchObject({ appName: 'Browser', bundleId: 'com.example.browser', agent: true, nativeScreens: ['Main'] })
    expect(validateMacosDesktop(resolveMacosDesktop(config.macos, '0.1.0'))).toEqual([])
  })

  test('the screen calls the route the agent stub serves', () => {
    const files = desktopScaffoldFiles(appIdentity('/x/my-browser'))
    expect(files['resources/native/Main.stx']).toContain('fetch(\'/api/desktop/status\')')
    expect(files['app/Desktop/Agent.ts']).toContain('route.get(\'/api/desktop/status\'')
    expect(files['resources/native/Main.stx']).toContain(':text="\'My Browser\'"')
  })

  test('keeps whatever the app already has', () => {
    const root = app()
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'config/desktop.ts'), 'export default { mine: true }\n')
    writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'browser', scripts: { 'dev:desktop': 'custom' } })}\n`)
    const written = scaffoldDesktopApp(root, appIdentity(root))
    expect(written).not.toContain('config/desktop.ts')
    expect(readFileSync(join(root, 'config/desktop.ts'), 'utf8')).toBe('export default { mine: true }\n')
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['dev:desktop']).toBe('custom')
    // Running it again writes nothing.
    expect(scaffoldDesktopApp(root, appIdentity(root))).toEqual([])
  })

  test('no user-visible string carries an em-dash', () => {
    for (const content of Object.values(desktopScaffoldFiles(appIdentity('/x/browser'))))
      expect(content).not.toMatch(/[—–]/)
  })
})

describe('the target directory', () => {
  test('one holding only .git is empty enough: a repository cloned before scaffolding', () => {
    const root = app()
    rmSync(join(root, 'package.json'))
    mkdirSync(join(root, '.git'))
    expect(scaffoldTargetOccupants(root)).toEqual([])
  })

  test('anything else in it is a project that must not be overwritten', () => {
    const root = app()
    mkdirSync(join(root, '.git'))
    expect(scaffoldTargetOccupants(root)).toEqual(['package.json'])
  })

  test('a directory that does not exist yet has no occupants', () => {
    expect(scaffoldTargetOccupants(join(tmpdir(), 'stacks-no-such-dir-9f2c'))).toEqual([])
  })
})
