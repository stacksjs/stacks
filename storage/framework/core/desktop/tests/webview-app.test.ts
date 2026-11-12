import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { compareVersions } from '../src/updater'
import {
  bunCompileTarget,
  collectViewFiles,
  parseDesktopTargets,
  probeCraftFlags,
  releaseArtifactNames,
  releaseVersionProblem,
  renderWebviewEntitlements,
  renderWebviewInfoPlist,
  resolveWebviewDesktop,
  signtoolArgs,
  validateWebviewDesktop,
  webviewCompileArgs,
  webviewManifest,
  webviewPackageConfig,
  webviewRuntimeFor,
} from '../src/webview-app'

const scratch: string[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-webview-app-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const base = { appName: 'Fettler', appId: 'org.fettler.app' }
const keys = { main: 'ed25519-public:MCowBQYDK2VwAyEA' }

describe('desktop.webview, resolved', () => {
  test('defaults: the package version, a 1280 by 800 window titled with the app, views in resources/desktop', () => {
    const config = resolveWebviewDesktop(base, '0.3.1')
    expect(config.version).toBe('0.3.1')
    expect(config.window).toEqual({ title: 'Fettler', width: 1280, height: 800 })
    expect(config.agent.views).toBe('resources/desktop')
    expect(config.output).toBe('storage/framework/desktop/webview')
    expect(config.executable).toBe('Fettler')
    expect(config.slug).toBe('fettler')
  })

  test('a name with spaces and symbols still makes a file name and a package name', () => {
    const config = resolveWebviewDesktop({ ...base, appName: 'Repro & Co: Studio' })
    expect(config.executable).toBe('Repro  Co Studio')
    expect(config.slug).toBe('repro-co-studio')
  })

  test('what cannot build is said before anything is compiled', () => {
    expect(validateWebviewDesktop(resolveWebviewDesktop(base, '0.3.0'))).toEqual([])
    const errors = validateWebviewDesktop(resolveWebviewDesktop({
      appName: ' ',
      appId: 'fettler',
      urlSchemes: ['fettler', 'not a scheme'],
      updates: { feedUrl: 'http://fettler.org/api/updates', publicKeys: { main: 'ed25519-private:oops' } },
    }, 'latest'))
    expect(errors).toEqual([
      'webview.appName is required',
      'webview.appId must be reverse-DNS, like org.example.app (got "fettler")',
      'webview.version must be a semantic version (got "latest")',
      'webview.urlSchemes: "not a scheme" is not a URL scheme',
      'webview.updates.feedUrl must be https',
      'webview.updates.publicKeys.main is not a public key (it starts with ed25519-public:)',
    ])
    expect(validateWebviewDesktop(resolveWebviewDesktop({ ...base, updates: { feedUrl: 'https://fettler.org/api/updates', publicKeys: {} } }, '0.3.0'))[0]).toContain('needs at least one key')
  })

  test('the manifest carries updates into a built app and leaves them out of a development run', () => {
    const config = resolveWebviewDesktop({ ...base, window: { devtools: false }, agent: { publicPaths: ['/mcp'], startPath: '/start' }, urlSchemes: ['fettler'], updates: { feedUrl: 'https://fettler.org/api/updates', publicKeys: keys, disk: 's3', prefix: 'fettler' } }, '0.3.0')
    const built = webviewManifest(config, { runtime: 'beside', runtimeFlags: ['--single-instance'], sourceRevision: 'a'.repeat(40) })
    // Where the release publishes is the releaser's business, not the app's.
    expect(built.updates).toEqual({ feedUrl: 'https://fettler.org/api/updates', publicKeys: keys })
    expect(built).toMatchObject({ runtime: 'beside', startPath: '/start', publicPaths: ['/mcp'], urlSchemes: ['fettler'], runtimeFlags: ['--single-instance'] })
    expect(built.window.devtools).toBeUndefined()
    const development = webviewManifest(config, { runtime: '/bin/craft', development: true })
    expect(development.updates).toBeUndefined()
    expect(development.window.devtools).toBe(true)
  })
})

describe('targets', () => {
  test('default is this machine; a list or all names others', () => {
    expect(parseDesktopTargets(undefined, 'darwin-arm64')).toEqual(['darwin-arm64'])
    expect(parseDesktopTargets('linux-x64, win32-x64,linux-x64', 'darwin-arm64')).toEqual(['linux-x64', 'win32-x64'])
    expect(parseDesktopTargets('macos-arm64,windows-x64')).toEqual(['darwin-arm64', 'win32-x64'])
    expect(parseDesktopTargets('all')).toHaveLength(6)
    expect(() => parseDesktopTargets('solaris-sparc')).toThrow('Unknown desktop target "solaris-sparc"')
  })

  test('Bun cross-compiles other targets, without bytecode from this machine\'s engine', () => {
    expect(bunCompileTarget('win32-x64')).toBe('bun-windows-x64')
    const own = webviewCompileArgs({ entry: 'e.ts', outfile: 'out', target: 'darwin-arm64', host: 'darwin-arm64' })
    expect(own).toContain('--bytecode')
    expect(own.some(arg => arg.startsWith('--target'))).toBe(false)
    const cross = webviewCompileArgs({ entry: 'e.ts', outfile: 'out.exe', target: 'win32-x64', host: 'darwin-arm64' })
    expect(cross).toContain('--target=bun-windows-x64')
    expect(cross).not.toContain('--bytecode')
    expect(cross).toContain('--windows-hide-console')
    for (const args of [own, cross]) {
      expect(args).toContain('--no-compile-autoload-bunfig')
      expect(args).toContain('--no-compile-autoload-dotenv')
    }
    expect(webviewCompileArgs({ entry: 'e.ts', outfile: 'out', target: 'linux-x64', host: 'linux-x64', minify: false })).not.toContain('--minify')
  })

  test('each target needs its own Craft runtime; only this machine\'s has a fallback', () => {
    const root = temporary()
    writeFileSync(join(root, 'craft-linux'), 'elf')
    const hostRuntime = (): string => '/usr/local/bin/craft'
    expect(webviewRuntimeFor({}, 'darwin-arm64', { root, env: {}, host: 'darwin-arm64', hostRuntime })).toBe('/usr/local/bin/craft')
    expect(webviewRuntimeFor({ runtime: { 'linux-x64': 'craft-linux' } }, 'linux-x64', { root, env: {}, host: 'darwin-arm64', hostRuntime })).toBe(join(root, 'craft-linux'))
    expect(webviewRuntimeFor({}, 'linux-x64', { root, env: { CRAFT_BIN_LINUX_X64: join(root, 'craft-linux') }, host: 'darwin-arm64', hostRuntime })).toBe(join(root, 'craft-linux'))
    expect(() => webviewRuntimeFor({}, 'win32-x64', { root, env: {}, host: 'darwin-arm64', hostRuntime })).toThrow('No Craft runtime for win32-x64')
    expect(() => webviewRuntimeFor({ runtime: { 'win32-x64': 'missing.exe' } }, 'win32-x64', { root, env: {}, host: 'darwin-arm64' })).toThrow('does not exist')
  })

  test('the runtime is read, not run, to learn which flags it knows', () => {
    const directory = temporary()
    const newer = join(directory, 'craft-new')
    const older = join(directory, 'craft-old')
    writeFileSync(newer, Buffer.concat([Buffer.from([0xCF, 0xFA, 0xED, 0xFE]), Buffer.from('\0--url\0--single-instance\0--deep-link\0--app-name\0')]))
    writeFileSync(older, Buffer.concat([Buffer.from([0xCF, 0xFA, 0xED, 0xFE]), Buffer.from('\0--url\0--deep-link\0')]))
    expect(probeCraftFlags(newer)).toEqual(['--single-instance', '--deep-link', '--app-name'])
    expect(probeCraftFlags(older)).toEqual(['--deep-link'])
  })
})

describe('what a build is made from', () => {
  test('built views are collected by request path', () => {
    const directory = temporary()
    mkdirSync(join(directory, '_stx'))
    writeFileSync(join(directory, 'index.html'), '')
    writeFileSync(join(directory, '_stx', 'a.js'), '')
    writeFileSync(join(directory, '.DS_Store'), '')
    expect(collectViewFiles(directory)).toEqual({ '/_stx/a.js': join(directory, '_stx', 'a.js'), '/index.html': join(directory, 'index.html') })
    expect(collectViewFiles(join(directory, 'missing'))).toEqual({})
  })

  test('the Info.plist names the bundle, its link schemes and a loopback-only transport exception', () => {
    const { xml, ignored } = renderWebviewInfoPlist(resolveWebviewDesktop({ ...base, appName: 'Repro & Co', urlSchemes: ['fettler'], macos: { bundleId: 'org.fettler.mac', infoPlist: { CFBundleExecutable: 'evil', NSHumanReadableCopyright: '2026' } } }, '0.3.0'), { iconFile: 'AppIcon' })
    expect(xml).toContain('<string>Repro &amp; Co</string>')
    expect(xml).toContain('<key>CFBundleIdentifier</key><string>org.fettler.mac</string>')
    expect(xml).toContain('<string>fettler</string>')
    expect(xml).toContain('NSAllowsLocalNetworking')
    expect(xml).not.toContain('<key>NSAllowsArbitraryLoads</key>')
    expect(xml).toContain('<string>13.0</string>')
    expect(xml).toContain('NSHumanReadableCopyright')
    expect(ignored).toEqual(['CFBundleExecutable'])
  })

  test('the entitlements let a compiled Bun agent run under the hardened runtime, plus the app\'s own', () => {
    const xml = renderWebviewEntitlements(resolveWebviewDesktop({ ...base, macos: { entitlements: { 'com.apple.security.automation.apple-events': true } } }))
    expect(xml).toContain('com.apple.security.cs.allow-jit')
    expect(xml).toContain('com.apple.security.automation.apple-events')
    // Not sandboxed: a sandboxed app cannot spawn the tools an agent exists to run.
    expect(xml).not.toContain('app-sandbox')
  })

  test('Craft\'s packaging input: MSI with the runtime beside the executable, or one Linux binary', () => {
    const config = resolveWebviewDesktop({ ...base, description: 'Tinker', publisher: 'Stacks.js', urlSchemes: ['fettler'], windows: { certificatePath: 'cert.pfx' }, linux: { debDependencies: ['libwebkit2gtk-4.1-0'] } }, '0.3.0')
    const windows = webviewPackageConfig(config, 'win32-x64', { binary: 'C:/out/Fettler.exe', additionalFiles: ['C:/out/craft-runtime.exe'], outDir: 'C:/out/packages' })
    expect(windows).toMatchObject({ name: 'Fettler', version: '0.3.0', author: 'Stacks.js', bundleId: 'org.fettler.app', binaryPath: 'C:/out/Fettler.exe', platforms: ['windows'] })
    expect(windows.windows).toEqual({ msi: true, zip: true, architecture: 'x64', additionalFiles: ['C:/out/craft-runtime.exe'], urlSchemes: ['fettler'], certificatePath: 'cert.pfx' })
    // The certificate's password never reaches the file written beside the build.
    expect(JSON.stringify(windows)).not.toContain('Password')

    const linux = webviewPackageConfig(config, 'linux-arm64', { binary: '/out/fettler', outDir: '/out/packages' })
    expect(linux.platforms).toEqual(['linux'])
    expect(linux.linux).toEqual({ appImage: true, deb: true, rpm: true, categories: ['Development'], urlSchemes: ['fettler'], debDependencies: ['libwebkit2gtk-4.1-0'] })
  })

  test('signtool signs with SHA-256 and a timestamp', () => {
    expect(signtoolArgs({ file: 'Fettler.exe', certificatePath: 'cert.pfx', certificatePassword: 'pw' })).toEqual(['signtool.exe', 'sign', '/f', 'cert.pfx', '/p', 'pw', '/fd', 'SHA256', '/tr', 'http://timestamp.digicert.com', '/td', 'SHA256', 'Fettler.exe'])
    expect(signtoolArgs({ file: 'a.exe', certificatePath: 'c.pfx' })).not.toContain('/p')
  })
})

describe('a release', () => {
  test('each platform publishes the file an installed app can replace itself with', () => {
    const config = { appName: 'Repro & Co', version: '0.3.0' }
    expect(releaseArtifactNames(config, 'darwin-arm64')).toEqual({ update: 'Repro-Co-0.3.0-arm64.zip', downloads: ['Repro-Co-0.3.0-arm64.dmg'] })
    expect(releaseArtifactNames(config, 'win32-x64')).toEqual({ update: 'Repro-Co-0.3.0-x64.msi', downloads: [] })
    expect(releaseArtifactNames(config, 'linux-x64')).toEqual({ update: 'Repro-Co-0.3.0-x64.AppImage', downloads: ['Repro-Co-0.3.0-x64.deb', 'Repro-Co-0.3.0-x64.rpm'] })
  })

  test('a feed never goes backwards and never reuses a version', () => {
    expect(releaseVersionProblem('0.3.0', null, compareVersions)).toBeUndefined()
    expect(releaseVersionProblem('0.3.1', '0.3.0', compareVersions)).toBeUndefined()
    expect(releaseVersionProblem('0.3.0', '0.3.0', compareVersions)).toContain('already published')
    expect(releaseVersionProblem('0.2.9', '0.3.0', compareVersions)).toContain('newer than 0.2.9')
  })
})

describe('building the fixture app', () => {
  // A real build and a real launch of the compiled agent, with a program that exits at once standing in
  // for Craft: it proves the written entrypoint compiles with the views inside it and runs the launch
  // sequence, without opening a window. macOS, because the bundle is assembled and signed there.
  test.skipIf(process.platform !== 'darwin')('compiles an agent with the views inside it, bundles it, and the bundle runs', () => {
    const fixture = join(import.meta.dir, 'fixtures', 'webview-app')
    const home = temporary()
    const output = join(fixture, 'storage/framework/desktop/webview')
    const build = Bun.spawnSync(['bun', join(import.meta.dir, '../../actions/src/build/desktop-webview.ts')], {
      cwd: fixture,
      env: { ...process.env, CRAFT_BIN: '/usr/bin/true', DESKTOP_SIGNING_IDENTITY: '-', DESKTOP_TARGETS: `darwin-${process.arch}`, STACKS_DESKTOP_LAUNCH: '', DESKTOP_PACKAGE: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(`${build.exitCode} ${build.stderr.toString().split('\n').filter(line => /error/i.test(line)).join('\n')}`).toBe('0 ')

    const app = join(output, `darwin-${process.arch}`, 'Webview Fixture.app')
    expect(existsSync(join(app, 'Contents/MacOS/craft-runtime'))).toBe(true)
    expect(readFileSync(join(app, 'Contents/Info.plist'), 'utf8')).toContain('org.stacksjs.webview-fixture')
    expect(Bun.spawnSync(['codesign', '--verify', '--deep', '--strict', app]).exitCode).toBe(0)
    const record = JSON.parse(readFileSync(join(output, 'build.json'), 'utf8')) as { version: string, targets: Array<{ target: string, artifacts: Array<{ name: string }> }> }
    expect(record.version).toBe('0.2.0')
    expect(record.targets[0]!.artifacts[0]!.name).toBe('Webview Fixture.app')

    const log = join(home, 'fixture.log')
    const launched = Bun.spawnSync([join(app, 'Contents/MacOS/Webview Fixture'), './project'], { cwd: home, env: { HOME: home, PATH: '/usr/bin:/bin', WEBVIEW_FIXTURE_LOG: log }, stdout: 'pipe', stderr: 'pipe' })
    expect(launched.exitCode).toBe(0)
    const lines = readFileSync(log, 'utf8').trim().split('\n')
    expect(lines[0]).toMatch(/^start http:\/\/127\.0\.0\.1:\d+ \["\.\/project"\]$/)
    expect(lines.at(-1)).toBe('stop')
    // Its data went under the home it was given, and the lock was released on the way out.
    expect(existsSync(join(home, 'Library/Application Support/Webview Fixture/agent.port'))).toBe(true)
    expect(existsSync(join(home, 'Library/Application Support/Webview Fixture/agent.lock'))).toBe(false)
  }, 180_000)
})
