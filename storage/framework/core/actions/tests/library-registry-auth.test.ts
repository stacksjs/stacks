import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { retainLibraryRelease } from '../src/library/release-artifacts'
import { publishPreparedLibraryRelease, readbackLibraryRelease } from '../src/library/release-registry'

// Public release HTTP/publisher boundaries prove scoped authentication and exact
// private archive readback. They do not qualify a live registry account.
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function fixture(mixed = false, restricted = true) {
  const root = await mkdtemp(join(tmpdir(), 'stacks-registry-auth-'))
  roots.push(root)
  const dir = join(root, 'package')
  await mkdir(join(dir, 'dist'), { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: '@example/private', version: '1.0.0', type: 'module', files: ['dist'], exports: './dist/index.js' }))
  await writeFile(join(dir, 'dist/index.js'), 'export const answer = 42\n')
  const directory = join(root, 'candidate')
  const plan = { name: '@example/private', version: '1.0.0', dir, registry: 'npm' as const, access: restricted ? 'restricted' as const : 'public' as const, tarballFiles: 1 }
  const packages = [plan]
  if (mixed) {
    const publicDir = join(root, 'public-package')
    await mkdir(join(publicDir, 'dist'), { recursive: true })
    await writeFile(join(publicDir, 'package.json'), JSON.stringify({ name: '@example/public', version: '1.0.0', files: ['dist'], exports: './dist/index.js' }))
    await writeFile(join(publicDir, 'dist/index.js'), 'export const answer = 42\n')
    packages.unshift({ ...plan, name: '@example/public', dir: publicDir, access: 'public' })
  }
  const candidate = await retainLibraryRelease({ directory, source: { repository: 'example/libraries', commit: 'a'.repeat(40) }, tag: 'latest', packages })
  return { root, directory, candidate, archive: await Bun.file(join(directory, candidate.packages[0]!.archive.path)).bytes() }
}

test('reads private metadata, archive and tags with only an explicitly origin-scoped bearer credential', async () => {
  const { directory, candidate, archive } = await fixture()
  const requested: string[] = []
  const token = 'fixture-read-token'
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (request.headers.get('authorization') !== `Bearer ${token}`) return new Response('', { status: 401 })
    const path = new URL(request.url).pathname
    requested.push(path)
    if (path.endsWith('.tgz')) return new Response(archive)
    const pkg = candidate.packages[0]!
    if (path.endsWith('/1.0.0')) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${server.url.origin}/private.tgz` } })
    return Response.json({ 'dist-tags': { latest: pkg.version } })
  } })
  try {
    const options = { npmRegistry: server.url.origin, readAuth: { registry: server.url.origin, token }, deadlineMs: 1000 }
    const receipt = await readbackLibraryRelease(directory, options)
    expect(requested).toEqual(['/%40example%2Fprivate/1.0.0', '/private.tgz', '/%40example%2Fprivate'])
    expect(receipt.packages[0]!.archiveSha256).toBe(candidate.packages[0]!.archive.sha256)
    expect(JSON.stringify(receipt)).not.toContain(token)
    expect(JSON.stringify(candidate)).not.toContain(token)
  }
  finally { server.stop(true) }
})

test('rejects missing restricted read credentials before invoking any publisher in a mixed public/private set', async () => {
  const { directory } = await fixture(true)
  let uploads = 0
  await expect(publishPreparedLibraryRelease(directory, { publisher: 'bun', execute: async () => { uploads++; return 0 }, fetch: async () => new Response('', { status: 404 }), deadlineMs: 100 })).rejects.toThrow('scoped registry read credential')
  expect(uploads).toBe(0)
})

test('resolves standard read credentials for canonical npmjs only and never reads ambient credentials for custom origins', async () => {
  const { resolveLibraryRegistryReadAuth } = await import('../src/library/release-registry-auth')
  const environment = { NPM_READ_TOKEN: 'read-only', NODE_AUTH_TOKEN: 'publisher-token' }
  expect(resolveLibraryRegistryReadAuth({}, environment)).toEqual({ registry: 'https://registry.npmjs.org', token: 'read-only' })
  expect(resolveLibraryRegistryReadAuth({}, { NODE_AUTH_TOKEN: 'publisher-token' })).toEqual({ registry: 'https://registry.npmjs.org', token: 'publisher-token' })
  expect(resolveLibraryRegistryReadAuth({}, { NPM_READ_TOKEN: '', NODE_AUTH_TOKEN: '' })).toBeUndefined()
  expect(resolveLibraryRegistryReadAuth({}, { NPM_READ_TOKEN: '', NODE_AUTH_TOKEN: 'publisher-token' })?.token).toBe('publisher-token')
  expect(resolveLibraryRegistryReadAuth({ npmRegistry: 'https://private.example.test' }, environment)).toBeUndefined()
  expect(resolveLibraryRegistryReadAuth({ npmRegistry: 'https://private.example.test', readAuth: { registry: 'https://private.example.test', token: 'private-read' } }, environment)).toEqual({ registry: 'https://private.example.test', token: 'private-read' })
})

test.each([
  { registry: 'https://registry.npmjs.org', token: 'fixture-read' },
  { registry: 'http://127.0.0.1:1', token: '' },
  { registry: 'http://127.0.0.1:1', token: 'fixture\r\nInjected: yes' },
  { registry: 'http://127.0.0.1:1', token: 'fixture\0token' },
  { registry: 'http://127.0.0.1:1', token: 'fixture token' },
])('rejects wrong origins and malformed credential inputs before HTTP or publisher invocation', async (auth) => {
  const { directory } = await fixture()
  let reads = 0, uploads = 0
  const options = { npmRegistry: 'http://127.0.0.1:1', readAuth: auth, publisher: 'bun' as const,
    fetch: async () => { reads++; throw new Error('Unexpected HTTP request') }, execute: async () => { uploads++; return 0 } }
  await expect(publishPreparedLibraryRelease(directory, options)).rejects.toThrow('credential')
  expect(reads).toBe(0)
  expect(uploads).toBe(0)
})

test.each(['redirect', 'tarball', 'tarball-redirect'] as const)('does not send registry authorization across an origin via %s', async (mode) => {
  const { directory, candidate } = await fixture()
  let received = 0
  const other = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { received++; return new Response('must not receive a request') } })
  let authorized = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (request.headers.get('authorization') === 'Bearer fixture-read-token') authorized++
    if (mode === 'redirect') return Response.redirect(`${other.url.origin}/private`, 302)
    if (mode === 'tarball-redirect' && new URL(request.url).pathname.endsWith('.tgz')) return Response.redirect(`${other.url.origin}/private.tgz`, 302)
    const pkg = candidate.packages[0]!
    return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${mode === 'tarball' ? other.url.origin : server.url.origin}/private.tgz` } })
  } })
  try {
    await expect(readbackLibraryRelease(directory, { npmRegistry: server.url.origin, readAuth: { registry: server.url.origin, token: 'fixture-read-token' }, deadlineMs: 1000 })).rejects.toThrow(mode.includes('redirect') ? 'HTTP 302' : 'outside its actual registry origin')
    expect(authorized).toBe(mode === 'tarball-redirect' ? 2 : 1)
    expect(received).toBe(0)
  }
  finally { server.stop(true); other.stop(true) }
})

test('a wrong private token fails once without invoking a publisher or exposing response credentials', async () => {
  const { directory } = await fixture()
  let reads = 0, uploads = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { reads++; return new Response('fixture-private-response-secret', { status: 401 }) } })
  try {
    await expect(publishPreparedLibraryRelease(directory, { npmRegistry: server.url.origin, readAuth: { registry: server.url.origin, token: 'incorrect-token' }, publisher: 'bun', execute: async () => { uploads++; return 0 } })).rejects.toThrow('HTTP 401')
    expect(reads).toBe(1)
    expect(uploads).toBe(0)
  }
  finally { server.stop(true) }
})

test('the default real Bun publisher uploads an original archive and reads a private registry with scoped authentication', async () => {
  const { root, directory, candidate, archive } = await fixture()
  const token = 'fixture-private-token'
  let uploaded: Uint8Array | undefined
  let puts = 0, authenticatedReads = 0, denied = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    if (request.headers.get('authorization') !== `Bearer ${token}`) { denied++; return new Response('', { status: 401 }) }
    if (request.method === 'PUT') {
      puts++
      const body = await request.json() as { _attachments: Record<string, { data: string }> }
      uploaded = new Uint8Array(Buffer.from(Object.values(body._attachments)[0]!.data, 'base64'))
      return Response.json({ ok: true }, { status: 201 })
    }
    authenticatedReads++
    if (!uploaded) return new Response('', { status: 404 })
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response(uploaded)
    const pkg = candidate.packages[0]!
    if (new URL(request.url).pathname.endsWith('/1.0.0')) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${server.url.origin}/private.tgz` } })
    return Response.json({ 'dist-tags': { latest: pkg.version } })
  } })
  const home = join(root, 'isolated-home')
  await mkdir(home)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, name: 'local-private-registry-probe', version: '0.0.0', type: 'module' }))
  await writeFile(join(root, '.npmrc'), `registry=${server.url.origin}\n//127.0.0.1:${server.port}/:_authToken=${token}\n`, { mode: 0o600 })
  const probe = join(root, 'publish.ts')
  await writeFile(probe, `import {realpathSync} from 'node:fs';
import {publishPreparedLibraryRelease,readbackLibraryRelease} from ${JSON.stringify(join(import.meta.dir, '../src/library/release-registry.ts'))};
if(realpathSync(Bun.which('bun'))!==realpathSync(process.execPath))throw new Error('Expected actual isolated Bun publisher');
const endpoint=new URL(${JSON.stringify(server.url.origin)});if(endpoint.hostname!=='127.0.0.1'||!endpoint.port)throw new Error('Expected owned loopback registry');
const options={publisher:'bun',cwd:process.cwd(),npmRegistry:endpoint.origin,readAuth:{registry:endpoint.origin,token:${JSON.stringify(token)}},deadlineMs:10000,retryDelayMs:1};
const receipt=await publishPreparedLibraryRelease(${JSON.stringify(directory)},options);
const retry=await publishPreparedLibraryRelease(${JSON.stringify(directory)},options);
const readback=await readbackLibraryRelease(${JSON.stringify(directory)},options);
if(JSON.stringify([receipt,retry,readback]).includes(${JSON.stringify(token)}))throw new Error('Credential leaked into a receipt');
await Bun.write(${JSON.stringify(join(root, 'outcome.json'))},JSON.stringify({receipt,retry,readback}));
`)
  try {
    const { dirname } = await import('node:path')
    const child = Bun.spawn([process.execPath, '--no-env-file', probe], { cwd: root,
      env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: join(home, 'cache'), NPM_CONFIG_CACHE: join(home, 'cache'), NPM_CONFIG_USERCONFIG: join(home, '.npmrc'), NPM_CONFIG_GLOBALCONFIG: join(home, 'global.npmrc'), NPM_TOKEN: '', NPM_READ_TOKEN: '', NODE_AUTH_TOKEN: '', BUN_AUTH_TOKEN: '', BUN_OPTIONS: '', NODE_OPTIONS: '', NPM_CONFIG_UPDATE_NOTIFIER: 'false', NPM_CONFIG_AUDIT: 'false' }, stdout: 'pipe', stderr: 'pipe' })
    const [exit, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exit, `${output}\n${error}`).toBe(0)
    const outcome = await Bun.file(join(root, 'outcome.json')).json()
    expect(outcome.receipt.packages[0].status).toBe('published')
    expect(outcome.retry.packages[0].status).toBe('existing-identical')
    expect(outcome.readback.packages[0].archiveSha256).toBe(candidate.packages[0]!.archive.sha256)
    expect(uploaded).toEqual(archive)
    expect(puts).toBe(1)
    expect(authenticatedReads).toBeGreaterThanOrEqual(7)
    expect(denied).toBe(0)
  }
  finally { server.stop(true) }
}, 20_000)

test('keeps public readback anonymous when no scoped read credential is configured', async () => {
  const { directory, candidate, archive } = await fixture(false, false)
  const seen: Array<string | null> = []
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    seen.push(request.headers.get('authorization'))
    if (new URL(request.url).pathname.endsWith('.tgz')) return new Response(archive)
    const pkg = candidate.packages[0]!
    if (new URL(request.url).pathname.endsWith('/1.0.0')) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${server.url.origin}/private.tgz` } })
    return Response.json({ 'dist-tags': { latest: pkg.version } })
  } })
  try {
    await readbackLibraryRelease(directory, { npmRegistry: server.url.origin })
    expect(seen).toEqual([null, null, null])
  }
  finally { server.stop(true) }
})
