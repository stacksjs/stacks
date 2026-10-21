import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isNativeProject, scaffoldNativeProject, runNativeProjectCommand } from '../src/native-project'

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
