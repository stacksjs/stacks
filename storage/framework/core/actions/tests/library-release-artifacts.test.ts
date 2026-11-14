import { afterEach, expect, test } from 'bun:test'
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectLibraryRelease, materializeLibraryRelease, retainLibraryRelease } from '../src/library/release-artifacts'

// The public artifact seam proves archive/source identity and safe restoration;
// it does not assert registry credentials or provider authorization.
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const source = { repository: 'example/libraries', commit: '1234567890abcdef1234567890abcdef12345678' }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'stacks-retained-library-'))
  roots.push(root)
  const dir = join(root, 'package')
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@example/math', version: '1.2.3-alpha.1', type: 'module', files: ['dist'], exports: { '.': './dist/index.js' } }))
  await writeFile(join(dir, 'dist/index.js'), 'export const add = (a, b) => a + b\n')
  return { root, dir }
}

test('retains the original packed bytes and restores a clean installable function package', async () => {
  const { root, dir } = await fixture()
  const directory = join(root, 'candidate')
  const retained = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 }] })
  expect(retained.packages[0]!.archive.integrity).toMatch(/^sha512-/)
  expect(retained.packages[0]!.archive.files['dist/index.js']!.bytes).toBe(35)
  expect((await inspectLibraryRelease(directory, source)).packages[0]!.name).toBe('@example/math')
  const restored = join(root, 'restored')
  await materializeLibraryRelease(directory, restored)
  expect((await import(join(restored, '0/dist/index.js'))).add(2, 3)).toBe(5)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, dependencies: { '@example/math': `file:${join(directory, retained.packages[0]!.archive.path)}` } }))
  const installed = Bun.spawnSync(['bun', 'install', '--ignore-scripts'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(installed.exitCode).toBe(0)
  expect((await import(join(root, 'node_modules/@example/math/dist/index.js'))).add(5, 6)).toBe(11)
  await writeFile(join(directory, retained.packages[0]!.archive.path), 'tampered')
  await expect(inspectLibraryRelease(directory, source)).rejects.toThrow('identity')
})

test('publishes the retained tgz and skips only an identical existing version on partial retry', async () => {
  const { publishPreparedLibraryRelease } = await import('../src/library/release-registry')
  const { root, dir } = await fixture()
  const directory = join(root, 'candidate')
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 }] })
  const archive = new Uint8Array(await Bun.file(join(directory, candidate.packages[0]!.archive.path)).arrayBuffer())
  let visible = false
  const commands: string[][] = []
  const request = async (url: string): Promise<Response> => {
    if (!visible) return new Response('', { status: 404 })
    if (url.endsWith('.tgz')) return new Response(archive)
    if (url.endsWith('/1.2.3-alpha.1')) return Response.json({ name: '@example/math', version: '1.2.3-alpha.1', dist: { tarball: 'https://registry.npmjs.org/math.tgz', integrity: candidate.packages[0]!.archive.integrity } })
    return Response.json({ 'dist-tags': { alpha: '1.2.3-alpha.1' } })
  }
  const options = { publisher: 'bun' as const, which: (bin: string) => bin, fetch: request, execute: async (args: string[]) => { commands.push(args); visible = true; return 0 } }
  const receipt = await publishPreparedLibraryRelease(directory, options)
  expect(commands).toEqual([['bun', 'publish', '--tag', 'alpha', join(directory, 'archives/0.tgz'), '--access', 'public', '--ignore-scripts', '--registry', 'https://registry.npmjs.org']])
  expect(receipt.packages[0]!.status).toBe('published')
  expect(receipt.packages[0]!.registryOrigin).toBe('https://registry.npmjs.org')
  expect(receipt.packages[0]).not.toHaveProperty('tarball')
  expect((await publishPreparedLibraryRelease(directory, options)).packages[0]!.status).toBe('existing-identical')
  expect(commands).toHaveLength(1)
})

test('rejects source, retained hosted, export and archive tampering before publisher execution', async () => {
  const { root, dir } = await fixture()
  const directory = join(root, 'candidate')
  const plan = { name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm' as const, access: 'public' as const, tarballFiles: 1 }
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ version: plan.version }))
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [{ ...plan, hosted: { manifest: 'manifest.json', files: [{ path: 'manifest.json', source: join(root, 'manifest.json') }, { path: 'bundle.js', source: join(dir, 'dist/index.js'), packagePath: 'dist/index.js' }] } }] })
  await materializeLibraryRelease(directory, join(root, 'restored-with-hosted'))
  expect(await Bun.file(join(root, 'restored-with-hosted/hosted/0/bundle.js')).text()).toBe(await Bun.file(join(dir, 'dist/index.js')).text())
  await expect(inspectLibraryRelease(directory, { ...source, commit: 'b'.repeat(40) })).rejects.toThrow('source identity')
  await expect(retainLibraryRelease({ directory, source, tag: 'alpha', packages: [plan] })).rejects.toThrow()
  await writeFile(join(directory, 'hosted/0/bundle.js'), 'export const secret = 1')
  await expect(inspectLibraryRelease(directory)).rejects.toThrow('hosted identity')
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: plan.name, version: plan.version, exports: './missing.js' }))
  await expect(retainLibraryRelease({ directory: join(root, 'invalid-export'), source, tag: 'alpha', packages: [plan] })).rejects.toThrow('missing')
  expect(candidate.source.commit).toBe(source.commit)
})

test('keeps explicit unsupported selection terminal and discovers an archive-capable npm publisher', async () => {
  const { retainedArchivePublishCommand } = await import('../src/library/release-registry')
  const { root, dir } = await fixture()
  const candidate = await retainLibraryRelease({ directory: join(root, 'candidate'), source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 }] })
  expect(retainedArchivePublishCommand(candidate.packages[0]!, '/retained.tgz', { which: bin => bin })[0]).toBe('bun')
  expect(() => retainedArchivePublishCommand(candidate.packages[0]!, '/retained.tgz', { publisher: 'pantry', which: bin => bin })).toThrow('Unsupported publisher capability')
  expect(() => retainedArchivePublishCommand({ ...candidate.packages[0]!, registry: 'pantry' }, '/retained.tgz', { publisher: 'bun', which: bin => bin })).toThrow('Only pantry')
})

test('resumes a partially published package set, refusing different bytes without another upload', async () => {
  const { publishPreparedLibraryRelease } = await import('../src/library/release-registry')
  const { root, dir } = await fixture()
  const secondDir = join(root, 'second')
  await mkdir(join(secondDir, 'dist'), { recursive: true })
  await writeFile(join(secondDir, 'package.json'), JSON.stringify({ name: '@example/strings', version: '2.0.0', files: ['dist'], exports: './dist/index.js' }))
  await writeFile(join(secondDir, 'dist/index.js'), 'export const hello = () => "hi"')
  const directory = join(root, 'candidate')
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [
    { name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 },
    { name: '@example/strings', version: '2.0.0', dir: secondDir, registry: 'npm', access: 'restricted', tarballFiles: 1 },
  ] })
  const archives = await Promise.all(candidate.packages.map(pkg => Bun.file(join(directory, pkg.archive.path)).bytes()))
  const published = new Set<number>()
  let tamper = false
  let failSecond = true
  const calls: number[] = []
  const request = async (url: string): Promise<Response> => {
    const i = url.includes('strings') || url.includes('1.tgz') ? 1 : 0
    if (!published.has(i)) return new Response('', { status: 404 })
    const pkg = candidate.packages[i]!
    if (url.endsWith('.tgz')) return new Response(tamper ? new Uint8Array([0]) : archives[i]!)
    if (url.endsWith(`/${pkg.version}`)) return Response.json({ name: pkg.name, version: pkg.version, dist: { tarball: `https://registry.npmjs.org/${i}.tgz`, integrity: pkg.archive.integrity } })
    return Response.json({ 'dist-tags': { alpha: pkg.version } })
  }
  const options = { publisher: 'bun' as const, readAuth: { registry: 'https://registry.npmjs.org', token: 'fixture-read-only' }, which: (bin: string) => bin, fetch: request, execute: async (args: string[]) => {
    const i = args.some(arg => arg.endsWith('/1.tgz')) ? 1 : 0
    calls.push(i)
    if (i === 1 && failSecond) return 1
    published.add(i)
    return 0
  } }
  await expect(publishPreparedLibraryRelease(directory, options)).rejects.toThrow('failed with exit code 1')
  failSecond = false
  const retry = await publishPreparedLibraryRelease(directory, options)
  expect(calls).toEqual([0, 1, 1])
  expect(retry.packages.map(pkg => pkg.status)).toEqual(['existing-identical', 'published'])
  tamper = true
  await expect(publishPreparedLibraryRelease(directory, options)).rejects.toThrow('archive bytes differ')
  expect(calls).toEqual([0, 1, 1])
})

test.each(['bun', ...(Bun.which('npm') ? ['npm' as const] : [])] as const)('the actual %s publisher uploads the original retained archive to an owned local registry', async (publisher) => {
  const { publishPreparedLibraryRelease } = await import('../src/library/release-registry')
  const { root, dir } = await fixture()
  const packageHook = join(root, 'package-hook-ran')
  const packageManifest = await Bun.file(join(dir, 'package.json')).json()
  packageManifest.scripts = { prepublishOnly: `touch ${JSON.stringify(packageHook)}`, prepack: `touch ${JSON.stringify(packageHook)}`, prepare: `touch ${JSON.stringify(packageHook)}` }
  await writeFile(join(dir, 'package.json'), JSON.stringify(packageManifest))
  const directory = join(root, 'candidate')
  const candidate = await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 }] })
  await expect(access(packageHook)).rejects.toThrow()
  const original = await Bun.file(join(directory, 'archives/0.tgz')).bytes()
  let uploaded: Uint8Array | undefined
  let authorization = ''
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    if (request.method === 'PUT') {
      authorization = request.headers.get('authorization') ?? ''
      const body = await request.json() as { _attachments: Record<string, { data: string }> }
      uploaded = new Uint8Array(Buffer.from(Object.values(body._attachments)[0]!.data, 'base64'))
      return Response.json({ ok: true }, { status: 201 })
    }
    if (!uploaded) return new Response('', { status: 404 })
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response(uploaded)
    const pkg = candidate.packages[0]!
    if (new URL(request.url).pathname.endsWith(`/${pkg.version}`)) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${server.url.origin}/math.tgz` } })
    return Response.json({ 'dist-tags': { alpha: pkg.version } })
  } })
  const home = join(root, 'isolated-home')
  await mkdir(home)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, name: 'isolated-local-registry-consumer', version: '0.0.0', scripts: { prepublishOnly: `touch ${JSON.stringify(join(root, 'root-hook-ran'))}`, prepare: `touch ${JSON.stringify(join(root, 'root-hook-ran'))}` } }))
  await writeFile(join(root, '.npmrc'), `registry=${server.url.origin}\n//127.0.0.1:${server.port}/:_authToken=local-fixture-token\n`)
  try {
    const receipt = await publishPreparedLibraryRelease(directory, { publisher, cwd: root, npmRegistry: server.url.origin, deadlineMs: 10_000, retryDelayMs: 1, execute: async (args, execution) => {
      const child = Bun.spawn(args, { cwd: execution.cwd, env: { PATH: process.env.PATH!, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, NPM_CONFIG_CACHE: join(home, 'cache'), NPM_CONFIG_USERCONFIG: join(home, '.npmrc'), BUN_AUTH_TOKEN: 'local-fixture-token', NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_AUDIT: 'false' }, stdout: 'pipe', stderr: 'pipe' })
      const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      if (exit !== 0) throw new Error(`Local publisher failed: ${stdout} ${stderr}`)
      return exit
    } })
    expect(receipt.packages[0]!.status).toBe('published')
    expect(authorization).toBe('Bearer local-fixture-token')
    expect(uploaded).toEqual(original)
    await expect(access(packageHook)).rejects.toThrow()
    await expect(access(join(root, 'root-hook-ran'))).rejects.toThrow()
  }
  finally { server.stop(true) }
}, 20_000)

test('native preparation builds a function and two custom elements, retaining installable public subpaths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-native-release-'))
  roots.push(root)
  await mkdir(join(root, 'resources/functions'), { recursive: true })
  await mkdir(join(root, 'resources/components'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture-app', version: '3.0.0', private: true, type: 'module' }))
  await writeFile(join(root, 'resources/functions/add.ts'), 'export const add = (a: number, b: number) => a + b\n')
  await writeFile(join(root, 'resources/components/Badge.stx'), '<template><span class="badge">Ready</span></template>\n<style>.badge { color: green; }</style>')
  await writeFile(join(root, 'resources/components/Panel.stx'), '<template><section><slot></slot></section></template>\n<style>section { padding: 8px; }</style>')
  const directory = join(root, 'candidate')
  const modulePath = join(import.meta.dir, '../src/library/release-artifacts.ts')
  const child = Bun.spawn(['bun', '-e', `
    const {prepareLibraryRelease} = await import(${JSON.stringify(modulePath)})
    await prepareLibraryRelease({cwd:process.cwd(), directory:${JSON.stringify(directory)}, source:${JSON.stringify(source)}, tag:'alpha', config:{packages:[
      {name:'@example/native-functions',kind:'functions',include:['add.ts'],registry:'npm'},
      {name:'@example/native-elements',kind:'web-components',include:['Badge.stx','Panel.stx'],prefix:'sample',version:'4.2.0-alpha.1',registry:'npm'}
    ]}})
  `], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exit, `${stdout}\n${stderr}`).toBe(0)
  const candidate = await inspectLibraryRelease(directory)
  expect(candidate.packages.map(pkg => [pkg.name, pkg.version])).toEqual([['@example/native-functions', '3.0.0'], ['@example/native-elements', '4.2.0-alpha.1']])
  expect(candidate.packages[1]!.archive.files['dist/custom-elements.json']).toBeDefined()
  expect(candidate.packages[1]!.archive.files['dist/index.d.ts']).toBeDefined()
  const consumer = join(root, 'consumer')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'clean-consumer', private: true, type: 'module', dependencies: Object.fromEntries(candidate.packages.map(pkg => [pkg.name, `file:${join(directory, pkg.archive.path)}`])) }))
  const install = Bun.spawnSync(['bun', 'install', '--ignore-scripts'], { cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
  expect(install.exitCode, install.stderr.toString()).toBe(0)
  const manifest = await Bun.file(join(consumer, 'node_modules/@example/native-elements/dist/custom-elements.json')).json()
  expect(manifest.modules.flatMap((module: { declarations?: Array<{ tagName: string }> }) => module.declarations ?? []).map((declaration: { tagName: string }) => declaration.tagName)).toEqual(['sample-badge', 'sample-panel'])
  const module = await import(join(consumer, 'node_modules/@example/native-functions/dist/index.js'))
  expect(module.add(1, 8)).toBe(9)
}, 30_000)

test('dry-run validates the retained artifact and publisher without any registry request', async () => {
  const { publishPreparedLibraryRelease } = await import('../src/library/release-registry')
  const { root, dir } = await fixture()
  const directory = join(root, 'candidate')
  await retainLibraryRelease({ directory, source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1 }] })
  const commands: string[][] = []
  const receipt = await publishPreparedLibraryRelease(directory, { dryRun: true, which: bin => bin, fetch: async () => { throw new Error('Dry-run must not read registry state') }, execute: async args => { commands.push(args); return 0 } })
  expect(commands[0]).toContain('--dry-run')
  expect(commands[0]).toContain('--ignore-scripts')
  expect(receipt.packages[0]!.status).toBe('dry-run')
  expect(receipt.packages[0]!.registryOrigin).toBe('https://registry.npmjs.org')
  expect(receipt.packages[0]).not.toHaveProperty('tarball')
})

test('refuses conflicting archive paths before retaining installable bytes', async () => {
  const { root, dir } = await fixture()
  const archivePath = join(root, 'unsafe.tgz')
  await writeFile(archivePath, await new Bun.Archive({
    'package/package.json': JSON.stringify({ name: '@example/math', version: '1.2.3-alpha.1' }),
    'package/dist': 'file shadows directory',
    'package/dist/index.js': 'export const value = 1',
  }, { compress: 'gzip' }).bytes())
  await expect(retainLibraryRelease({ directory: join(root, 'candidate'), source, tag: 'alpha', packages: [{ name: '@example/math', version: '1.2.3-alpha.1', dir, registry: 'npm', access: 'public', tarballFiles: 1, archivePath }] })).rejects.toThrow('conflicting')
})
