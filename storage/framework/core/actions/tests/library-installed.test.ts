import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { libraryArchiveEntries } from '../src/library/archive'
import { inspectInstalledLibraryPackage } from '../src/library/installed'

// The public installed-payload seam observes real filesystem contents. It
// proves archive equality and containment, not registry or source ownership.
const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
async function installed() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-installed-'))
  roots.push(root)
  const directory = join(root, 'node_modules/@example/library')
  const expected = await libraryArchiveEntries(await new Bun.Archive({
    'package/package.json': '{"name":"@example/library","version":"1.0.0"}',
    'package/dist/index.js': 'export const value = 42',
  }, { compress: 'gzip' }).bytes())
  for (const [name, bytes] of expected) {
    mkdirSync(dirname(join(directory, name)), { recursive: true })
    writeFileSync(join(directory, name), bytes)
  }
  return { root, directory, expected }
}

test('returns the complete actual installed archive payload and rejects an extra private file', async () => {
  const { root, directory, expected } = await installed()
  const actual = inspectInstalledLibraryPackage(directory, expected, { consumerRoot: root })
  expect([...actual.keys()].sort()).toEqual(['dist/index.js', 'package.json'])
  expect(new TextDecoder().decode(actual.get('dist/index.js'))).toBe('export const value = 42')
  mkdirSync(join(directory, 'app'))
  writeFileSync(join(directory, 'app/private.ts'), 'const secret = "private"')
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('app/private.ts')
})

test('rejects missing and changed files, including a same-length mutation', async () => {
  const { directory, expected } = await installed()
  writeFileSync(join(directory, 'dist/index.js'), 'export const value = 43')
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('dist/index.js differs')
  rmSync(join(directory, 'dist/index.js'))
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('missing files')
})

test('rejects links at the package root, directory and file, and escapes of the consumer root', async () => {
  const { root, directory, expected } = await installed()
  symlinkSync(directory, join(root, 'linked'), 'dir')
  expect(() => inspectInstalledLibraryPackage(join(root, 'linked'), expected)).toThrow('real directory')
  expect(() => inspectInstalledLibraryPackage(directory, expected, { consumerRoot: join(root, 'linked') })).toThrow('outside its consumer root')
  mkdirSync(join(root, 'other-consumer'))
  symlinkSync(join(root, 'node_modules'), join(root, 'other-consumer/packages'), 'dir')
  expect(() => inspectInstalledLibraryPackage(join(root, 'other-consumer/packages/@example/library'), expected, { consumerRoot: join(root, 'other-consumer') })).toThrow('outside its consumer root')
  rmSync(join(directory, 'dist/index.js'))
  writeFileSync(join(root, 'outside.js'), 'export const value = 42')
  symlinkSync(join(root, 'outside.js'), join(directory, 'dist/index.js'))
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('symbolic link')
  rmSync(join(directory, 'dist'), { recursive: true })
  symlinkSync(root, join(directory, 'dist'), 'dir')
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('symbolic link')
})

test('bounds every entry, directory depth, individual and total file bytes', async () => {
  const { directory, expected } = await installed()
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxEntries: 2 })).toThrow('entry count')
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxFileBytes: 4 })).toThrow('budget')
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxBytes: 4 })).toThrow('budget')
  mkdirSync(join(directory, 'empty/deeper'), { recursive: true })
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxDepth: 1 })).toThrow('depth')
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxEntries: 0 })).toThrow('positive safe integers')
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxBytes: Infinity })).toThrow('positive safe integers')
})

test('rejects an oversized actual file before reading it and counts empty directory entries', async () => {
  const { directory, expected } = await installed()
  writeFileSync(join(directory, 'dist/index.js'), 'x'.repeat(1024))
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxFileBytes: 512 })).toThrow('file bytes exceed')
  writeFileSync(join(directory, 'dist/index.js'), expected.get('dist/index.js')!)
  for (let i = 0; i < 8; i++) mkdirSync(join(directory, `empty-${i}`))
  expect(() => inspectInstalledLibraryPackage(directory, expected, { maxEntries: 8 })).toThrow('entry count')
})

test('rejects unsafe expected and actual paths and unbundled dependencies', async () => {
  const { directory, expected } = await installed()
  expect(() => inspectInstalledLibraryPackage(directory, new Map([['../escape', new Uint8Array()]]))).toThrow('unsafe path')
  mkdirSync(join(directory, 'node_modules/other'), { recursive: true })
  writeFileSync(join(directory, 'node_modules/other/index.js'), 'export default true')
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('node_modules/other/index.js')
  rmSync(join(directory, 'node_modules'), { recursive: true })
  if (process.platform !== 'win32') {
    writeFileSync(join(directory, 'unsafe:name'), '')
    expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('unsafe path')
  }
})

test('permits only explicit well-formed root Bun installer metadata and counts its bytes', async () => {
  const { directory, expected } = await installed()
  const tag = `sha512-${'A'.repeat(86)}==`
  writeFileSync(join(directory, '.bun-tag'), tag)
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('.bun-tag')
  expect([...inspectInstalledLibraryPackage(directory, expected, { allowBunTag: true }).keys()].sort()).toEqual([...expected.keys()].sort())
  const archiveBytes = [...expected.values()].reduce((sum, bytes) => sum + bytes.length, 0)
  expect(() => inspectInstalledLibraryPackage(directory, expected, { allowBunTag: true, maxBytes: archiveBytes })).toThrow('budget')
  writeFileSync(join(directory, '.bun-tag'), 'x'.repeat(95))
  expect(() => inspectInstalledLibraryPackage(directory, expected, { allowBunTag: true })).toThrow('invalid Bun installer metadata')
  rmSync(join(directory, '.bun-tag'))
  symlinkSync(join(directory, 'package.json'), join(directory, '.bun-tag'))
  expect(() => inspectInstalledLibraryPackage(directory, expected, { allowBunTag: true })).toThrow('symbolic link')
})

test.skipIf(process.platform === 'win32')('rejects a special file without opening or blocking on it', async () => {
  const { directory, expected } = await installed()
  const result = Bun.spawnSync(['mkfifo', join(directory, 'pipe')])
  expect(result.exitCode).toBe(0)
  expect(() => inspectInstalledLibraryPackage(directory, expected)).toThrow('not a regular file')
})

test('accepts a real isolated Bun file-archive install without trusting arbitrary extra files', async () => {
  const { root, expected } = await installed()
  const consumer = join(root, 'consumer')
  const home = join(root, 'home')
  mkdirSync(consumer)
  mkdirSync(home)
  const archive = await new Bun.Archive(Object.fromEntries([...expected].map(([name, bytes]) => [`package/${name}`, bytes])), { compress: 'gzip' }).bytes()
  writeFileSync(join(consumer, 'fixture.tgz'), archive)
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, dependencies: { '@example/library': 'file:./fixture.tgz' } }))
  writeFileSync(join(home, '.npmrc'), '')
  const result = Bun.spawnSync([process.execPath, 'install', '--ignore-scripts'], {
    cwd: consumer, timeout: 15_000, env: { PATH: process.env.PATH, HOME: home, SystemRoot: process.env.SystemRoot, BUN_INSTALL_CACHE_DIR: join(home, 'cache'), NPM_CONFIG_USERCONFIG: join(home, '.npmrc') },
  })
  expect(result.exitCode, result.stderr.toString()).toBe(0)
  const directory = join(consumer, 'node_modules/@example/library')
  expect(readFileSync(join(directory, '.bun-tag'), 'utf8')).toMatch(/^sha512-[A-Za-z0-9+/]{86}==$/)
  expect(inspectInstalledLibraryPackage(directory, expected, { consumerRoot: consumer, allowBunTag: true }).size).toBe(2)
})
