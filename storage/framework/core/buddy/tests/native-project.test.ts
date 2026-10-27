import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildNativeProject, isNativeProject, parseNativeAppleFlags, scaffoldNativeProject, runNativeProjectCommand } from '../src/native-project'

const roots: string[] = []
const options = { buddyVersion: '0.75.255', stxVersion: '0.2.637' }
function temporary() {
  const root = mkdtempSync(join(tmpdir(), 'buddy native '))
  roots.push(root)
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('native app creation and adoption', () => {
  test('creates an offline native starter without server or database scaffolding', () => {
    const root = temporary()
    scaffoldNativeProject(root, options)
    expect(isNativeProject(root)).toBe(true)
    expect(readFileSync(join(root, '.github/workflows/buddy-bot.yml'), 'utf8')).toBe(readFileSync(join(import.meta.dir, '../../../defaults/vcs/github/workflows/buddy-bot.yml'), 'utf8').replaceAll('\r\n', '\n'))
    expect(readFileSync(join(root, 'config/buddy-bot.ts'), 'utf8')).not.toContain('__APP_SLUG__')
    expect(JSON.parse(readFileSync(join(root, '.github/renovate.json'), 'utf8')).enabled).toBe(false)
    expect(existsSync(join(root, 'src/app.stx'))).toBe(true)
    expect(existsSync(join(root, 'craft.config.ts'))).toBe(true)
    const pantry = JSON.parse(readFileSync(join(root, 'pantry.json'), 'utf8'))
    expect(pantry.native.runtime.revision).toMatch(/^[a-f0-9]{40}$/)
    expect(pantry.native.macos.notarize).toBe(true)
    expect(pantry.native.environment).toBe('production')
    expect(readFileSync(join(root, '.env.production'), 'utf8')).toContain('encrypted:v2:')
    expect(readFileSync(join(root, '.env.production'), 'utf8')).not.toContain('DOTENV_PRIVATE_KEY')
    if (process.platform !== 'win32') expect(statSync(join(root, '.env.keys')).mode & 0o777).toBe(0o600)
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toContain('.env.keys')
    expect(existsSync(join(root, 'routes'))).toBe(false)
    expect(existsSync(join(root, 'storage'))).toBe(false)
    expect(readFileSync(join(root, 'buddy'), 'utf8')).toContain('"$@"')
  })
  test('adopts an existing app while preserving its identity, dependencies and source', () => {
    const root = temporary()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'hushapp', version: '0.1.3', scripts: { test: 'bun test' }, dependencies: { '@stacksjs/stx': '^0.2.128' } }))
    writeFileSync(join(root, 'craft.config.ts'), 'export default { name: "Hush" }')
    writeFileSync(join(root, 'pantry.json'), JSON.stringify({ dependencies: { 'bun.com': '1.4.3' }, native: { macos: { maxBundleSize: 4194304 } } }))
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src/app.stx'), 'existing UI')
    scaffoldNativeProject(root, { ...options, adopt: true })
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('hushapp')
    expect(pkg.version).toBe('0.1.3')
    expect(pkg.dependencies['@stacksjs/stx']).toBe('^0.2.128')
    expect(pkg.scripts.test).toBe('bun test')
    expect(readFileSync(join(root, 'src/app.stx'), 'utf8')).toBe('existing UI')
    expect(readFileSync(join(root, 'craft.config.ts'), 'utf8')).toBe('export default { name: "Hush" }')
    const pantry = JSON.parse(readFileSync(join(root, 'pantry.json'), 'utf8'))
    expect(pantry.dependencies['bun.com']).toBe('1.4.3')
    expect(pantry.native.macos).toEqual({ notarize: true, maxBundleSize: 4194304 })
    const before = readFileSync(join(root, 'package.json'), 'utf8')
    const encrypted = readFileSync(join(root, '.env.production'), 'utf8')
    const privateKeys = readFileSync(join(root, '.env.keys'), 'utf8')
    scaffoldNativeProject(root, { ...options, adopt: true })
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before)
    expect(readFileSync(join(root, '.env.production'), 'utf8')).toBe(encrypted)
    expect(readFileSync(join(root, '.env.keys'), 'utf8')).toBe(privateKeys)
  })
  test('refuses occupied targets and incomplete adoption before writing', () => {
    const root = temporary()
    writeFileSync(join(root, 'keep.txt'), 'keep')
    expect(() => scaffoldNativeProject(root, options)).toThrow('--adopt')
    expect(() => scaffoldNativeProject(root, { ...options, adopt: true })).toThrow('requires package.json')
    expect(existsSync(join(root, 'buddy'))).toBe(false)
    expect(readFileSync(join(root, 'keep.txt'), 'utf8')).toBe('keep')
  })
  test('native upgrade dry run writes nothing and rejects unsupported framework sync flags', async () => {
    const root = temporary()
    scaffoldNativeProject(root, options)
    const before = readFileSync(join(root, 'package.json'), 'utf8')
    expect(await runNativeProjectCommand(root, ['upgrade', '--dry-run'])).toBe(true)
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before)
    await expect(runNativeProjectCommand(root, ['upgrade', '--from', '/framework'])).rejects.toThrow('Native upgrades support')
    expect(await runNativeProjectCommand(root, ['typecheck'])).toBe(false)
  })
})


test('adoption does not add a second, unused UI entry', () => {
  const root = temporary()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'images' }))
  writeFileSync(join(root, 'craft.config.ts'), 'export default { input: "src/pages/index.stx" }')
  scaffoldNativeProject(root, { ...options, adopt: true })
  expect(existsSync(join(root, 'src/app.stx'))).toBe(false)
})

test('native release rejects unsupported or incomplete flags before publication', async () => {
  const root = temporary()
  for (const flags of [['--bump'], ['--bump', 'calendar'], ['--force'], ['--bump', 'patch', '--unknown']])
    await expect(runNativeProjectCommand(root, ['release', ...flags])).rejects.toThrow('Native releases support')
})

test('resolves native backend source relative to the application, independently of cwd', async () => {
  const root = temporary()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'images', version: '1.0.0' }))
  writeFileSync(join(root, 'craft.config.ts'), 'export default { input: "src/pages/index.stx", backend: { entry: "src/api.ts", maxRequestBodySize: 123 } }')
  const pkg = join(root, 'node_modules/@stacksjs/stx')
  mkdirSync(pkg, { recursive: true })
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@stacksjs/stx', type: 'module', exports: { './craft': './craft.ts' } }))
  writeFileSync(join(pkg, 'craft.ts'), `export async function buildNative(config) {
    if (config.backend.entry !== ${JSON.stringify(join(root, 'src/api.ts'))}) throw new Error('Backend source escaped app root')
    if (config.backend.maxRequestBodySize !== 123) throw new Error('Backend options were lost')
    return { success: true, outputPath: config.output }
  }`)
  expect(await buildNativeProject(root)).toBe(join(root, 'dist'))
})


test.skipIf(process.platform !== 'darwin')('native dev rejects an unexpected child signal', async () => {
  const root = temporary()
  scaffoldNativeProject(root, options)
  const moduleRoot = join(root, 'node_modules/@stacksjs/stx')
  const executableRoot = join(root, 'fixture.app/Contents/MacOS')
  mkdirSync(moduleRoot, { recursive: true })
  mkdirSync(executableRoot, { recursive: true })
  writeFileSync(join(root, 'craft.config.ts'), 'export default { name: "Fixture" }')
  // This command-lifecycle fixture supplies its own compiler below. Runtime
  // provisioning is exercised by Pantry and the real app's native suite.
  writeFileSync(join(root, 'pantry.json'), '{ "native": {} }')
  writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/stx', type: 'module', exports: { './craft': './craft.js' } }))
  writeFileSync(join(moduleRoot, 'craft.js'), `export async function buildNative() { return { success: true, outputPath: ${JSON.stringify(join(root, 'fixture.app'))} } }`)
  const executable = join(executableRoot, 'Fixture')
  writeFileSync(executable, `#!${process.execPath}\nprocess.kill(process.pid, 'SIGTERM')\n`)
  chmodSync(executable, 0o755)
  await expect(runNativeProjectCommand(root, ['dev'])).rejects.toThrow('SIGTERM')
})

test('Pantry prepares distribution inputs and records the exact compiled artifact', async () => {
  const root = temporary()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.2.3' }))
  writeFileSync(join(root, 'craft.config.ts'), 'export default { name: "Fixture", bundleId: "com.example.fixture", target: "macos", minimumSystemVersion: "13.0" }')
  writeFileSync(join(root, 'pantry.json'), JSON.stringify({ native: { macos: { entitlements: { direct: { 'com.apple.security.cs.allow-jit': true } } } } }))
  const moduleRoot = join(root, 'node_modules/@stacksjs/stx')
  mkdirSync(moduleRoot, { recursive: true })
  writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/stx', type: 'module', exports: { './craft': './craft.ts' } }))
  writeFileSync(join(moduleRoot, 'craft.ts'), `import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
    export async function buildNative(config) {
      const entitlements = config.macosSigning.entitlements;
      if (!readFileSync(entitlements, 'utf8').includes('<true/>')) throw new Error('Missing entitlements');
      writeFileSync(${JSON.stringify(join(root, 'received.json'))}, JSON.stringify(config));
      mkdirSync(config.output + '/Fixture.app', { recursive: true });
      return { success: true, target: 'macos', outputPath: config.output + '/Fixture.app' };
    }`)
  const previous = { identity: process.env.APPLE_SIGNING_IDENTITY, number: process.env.PANTRY_BUILD_NUMBER, profile: process.env.APPLE_PROVISIONING_PROFILE, profilePath: process.env.APPLE_PROVISIONING_PROFILE_PATH }
  try {
    process.env.APPLE_SIGNING_IDENTITY = 'Developer ID Application: Fixture'
    process.env.PANTRY_BUILD_NUMBER = '123'
    delete process.env.APPLE_PROVISIONING_PROFILE
    delete process.env.APPLE_PROVISIONING_PROFILE_PATH
    await buildNativeProject(root)
    const received = JSON.parse(readFileSync(join(root, 'received.json'), 'utf8'))
    expect(received.infoPlist.CFBundleVersion).toBe('123')
    expect(existsSync(received.macosSigning.entitlements)).toBe(false)
    const artifact = JSON.parse(readFileSync(join(root, '.pantry/native/artifact.json'), 'utf8'))
    expect(artifact).toMatchObject({ name: 'Fixture', bundleId: 'com.example.fixture', version: '1.2.3', buildNumber: '123', path: join(root, 'dist/Fixture.app') })
  }
  finally {
    for (const [key, value] of Object.entries({ APPLE_SIGNING_IDENTITY: previous.identity, PANTRY_BUILD_NUMBER: previous.number, APPLE_PROVISIONING_PROFILE: previous.profile, APPLE_PROVISIONING_PROFILE_PATH: previous.profilePath })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('native Apple flags validate before any provider side effects', () => {
  expect(parseNativeAppleFlags(['--build-number', '23', '--submit-for-review'])).toEqual({ buildNumber: '23', submitForReview: true })
  for (const flags of [['--build-number'], ['--build-number', '0'], ['--build-number', '../x'], ['--unknown'], ['--validate-only', '--submit-for-review'], ['--package-only', '--validate-only']])
    expect(() => parseNativeAppleFlags(flags)).toThrow()
})

test('compiled native scaffolding carries the canonical bot templates without source files', () => {
  const directory = temporary()
  const root = join(directory, 'created')
  const source = join(directory, 'fixture.ts')
  const executable = join(directory, process.platform === 'win32' ? 'scaffold.exe' : 'scaffold')
  writeFileSync(source, `import { scaffoldNativeProject } from ${JSON.stringify(join(import.meta.dir, '../src/native-project.ts'))}; scaffoldNativeProject(${JSON.stringify(root)}, ${JSON.stringify(options)});`)
  const compiled = Bun.spawnSync([process.execPath, 'build', source, '--compile', '--outfile', executable], { cwd: directory })
  expect(compiled.exitCode).toBe(0)
  const created = Bun.spawnSync([executable], { cwd: directory })
  expect(created.exitCode).toBe(0)
  expect(readFileSync(join(root, '.github/workflows/buddy-bot.yml'), 'utf8')).toBe(readFileSync(join(import.meta.dir, '../../../defaults/vcs/github/workflows/buddy-bot.yml'), 'utf8').replaceAll('\r\n', '\n'))
}, 30000)
