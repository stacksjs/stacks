import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runNativeProjectCommand } from '../src/native-project'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'buddy-native-site-'))
  roots.push(root)
  const moduleRoot = join(root, 'node_modules/@stacksjs/stx')
  mkdirSync(moduleRoot, { recursive: true })
  writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: '@stacksjs/stx', type: 'module', exports: { './build': './build.js', './dev-server': './dev-server.js' } }))
  return { root, moduleRoot }
}

test('website build resolves the app compiler and isolates output from desktop artifacts', async () => {
  const { root, moduleRoot } = fixture()
  mkdirSync(join(root, 'dist/Fixture.app'), { recursive: true })
  writeFileSync(join(root, 'dist/Fixture.app/signed'), 'keep')
  writeFileSync(join(moduleRoot, 'build.js'), `import { writeFileSync } from 'node:fs'; export async function buildApp(options) {
    writeFileSync(${JSON.stringify(join(root, 'options.json'))}, JSON.stringify(options));
    return { mode: 'ssg', ssg: { failedCount: 0 } };
  }`)
  expect(await runNativeProjectCommand(root, ['build', '--site'])).toBe(true)
  expect(JSON.parse(readFileSync(join(root, 'options.json'), 'utf8'))).toEqual({ root, ssg: { outputDir: join(root, 'dist/site') }, ssr: { outputDir: join(root, 'dist/site') } })
  expect(readFileSync(join(root, 'dist/Fixture.app/signed'), 'utf8')).toBe('keep')
})

test('website render failures fail Buddy instead of reporting a successful native build', async () => {
  const { root, moduleRoot } = fixture()
  writeFileSync(join(moduleRoot, 'build.js'), 'export async function buildApp() { return { mode: "ssg", ssg: { failedCount: 1 } } }')
  await expect(runNativeProjectCommand(root, ['build', '--site'])).rejects.toThrow('Website build failed')
})

test('website development binds locally and never invokes Craft', async () => {
  const { root, moduleRoot } = fixture()
  writeFileSync(join(moduleRoot, 'dev-server.js'), `import { writeFileSync } from 'node:fs'; export async function serveApp(root, options) {
    writeFileSync(${JSON.stringify(join(root, 'options.json'))}, JSON.stringify({ root, ...options })); return false;
  }`)
  await expect(runNativeProjectCommand(root, ['dev', '--site', '--port', '4321'])).rejects.toThrow('could not start')
  expect(JSON.parse(readFileSync(join(root, 'options.json'), 'utf8'))).toEqual({ root, port: 4321, hostname: '127.0.0.1', native: false })
})

test('invalid website commands and ports fail before loading application code', async () => {
  const { root } = fixture()
  for (const flags of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', '1.2'], ['--unknown']])
    await expect(runNativeProjectCommand(root, ['dev', '--site', ...flags])).rejects.toThrow()
  await expect(runNativeProjectCommand(root, ['package', '--site'])).rejects.toThrow('--site supports')
  await expect(runNativeProjectCommand(root, ['build', '--site', '--port', '1234'])).rejects.toThrow('Unsupported website option')
})
