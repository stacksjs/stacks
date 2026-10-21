import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildNativeProject, isNativeProject, scaffoldNativeProject, runNativeProjectCommand } from '../src/native-project'

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
    expect(existsSync(join(root, 'src/app.stx'))).toBe(true)
    expect(existsSync(join(root, 'craft.config.ts'))).toBe(true)
    expect(existsSync(join(root, 'routes'))).toBe(false)
    expect(existsSync(join(root, 'storage'))).toBe(false)
    expect(readFileSync(join(root, 'buddy'), 'utf8')).toContain('"$@"')
  })
  test('adopts an existing app while preserving its identity, dependencies and source', () => {
    const root = temporary()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'hushapp', version: '0.1.3', scripts: { test: 'bun test' }, dependencies: { '@stacksjs/stx': '^0.2.128' } }))
    writeFileSync(join(root, 'craft.config.ts'), 'export default { name: "Hush" }')
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
    const before = readFileSync(join(root, 'package.json'), 'utf8')
    scaffoldNativeProject(root, { ...options, adopt: true })
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before)
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
  writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/stx', type: 'module', exports: { './craft': './craft.js' } }))
  writeFileSync(join(moduleRoot, 'craft.js'), `export async function buildNative() { return { success: true, outputPath: ${JSON.stringify(join(root, 'fixture.app'))} } }`)
  const executable = join(executableRoot, 'Fixture')
  writeFileSync(executable, `#!${process.execPath}\nprocess.kill(process.pid, 'SIGTERM')\n`)
  chmodSync(executable, 0o755)
  await expect(runNativeProjectCommand(root, ['dev'])).rejects.toThrow('SIGTERM')
})
