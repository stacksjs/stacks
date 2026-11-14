import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { libraryIntegrity, librarySha256 } from '../../src/library/release-artifacts'
import { acceptNativeLibraryRelease, libraryReleaseGit, prepareNativeLibraryRelease, publishNativeLibraryRelease, readbackNativeLibraryRelease } from '../../src/library/release-lifecycle'

const cwd = process.cwd()
const source = { repository: 'fixture/libraries', commit: libraryReleaseGit(cwd, ['rev-parse', 'HEAD']) }
const directory = join(cwd, 'candidate')
const prepared = await prepareNativeLibraryRelease({ cwd, directory, runId: 123, runAttempt: 1, branch: 'main' })
assert.equal(prepared.prepared, true)
assert.ok('candidate' in prepared)
const candidate = prepared.candidate!
assert.equal(candidate.source.tag, undefined)
assert.deepEqual(candidate.packages.map(pkg => [pkg.name, pkg.version, pkg.tag]), [['@fixture/math', '1.0.0', 'alpha'], ['@fixture/components', '3.1.0-beta.2', 'alpha'], ['@fixture/elements', '2.0.0-alpha.3', 'alpha']])
assert.ok(candidate.packages[1]!.archive.files['dist/custom-elements.json'])
assert.equal(await readFile('build-count', 'utf8'), 'x')
libraryReleaseGit(cwd, ['tag', 'v1.0.0'])
const zipped = Bun.spawnSync(['zip', '-q', '-r', join(cwd, 'provider.zip'), '.'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
assert.equal(zipped.exitCode, 0)
const zip = await readFile(join(cwd, 'provider.zip'))
const run = { id: 123, run_attempt: 1, head_sha: source.commit, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success', repository: { id: 5, full_name: source.repository }, head_repository: { id: 5, full_name: source.repository } }
const jobs = ['Lint', 'Typecheck', 'Test'].map(name => ({ name, status: 'completed', conclusion: 'success' }))
const artifact = { id: 321, name: 'stacks-library-candidate', expired: false, size_in_bytes: zip.length, expires_at: '2099-01-01T00:00:00Z', digest: `sha256:${librarySha256(zip)}`, workflow_run: { id: run.id, repository_id: 5, head_repository_id: 5, head_sha: source.commit } }
const originals = await Promise.all(candidate.packages.map(pkg => readFile(join(directory, pkg.archive.path))))
const published = new Map<string, Uint8Array>()
let uploads = 0
let registryReads = 0
let privateReads = 0
let corrupt = false
let channelAdvanced = false
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
  const url = new URL(request.url)
  const path = decodeURIComponent(url.pathname)
  if (request.method === 'PUT') {
    assert.equal(request.headers.get('authorization'), 'Bearer local-fixture-token')
    const payload = await request.json() as { name: string, _attachments: Record<string, { data: string }> }
    const index = candidate.packages.findIndex(pkg => pkg.name === payload.name)
    assert.ok(index >= 0)
    const upload = Buffer.from(Object.values(payload._attachments)[0]!.data, 'base64')
    assert.deepEqual(upload, originals[index])
    uploads++
    published.set(payload.name, upload)
    return Response.json({ ok: true }, { status: 201 })
  }
  const pkg = candidate.packages.find(pkg => path === `/${pkg.name}` || path === `/${pkg.name}/${pkg.version}` || path === `/${pkg.name}.tgz`)
  registryReads++
  if (!pkg) return new Response('missing', { status: 404 })
  if (pkg.access === 'restricted') {
    assert.equal(request.headers.get('authorization'), 'Bearer local-read-token')
    privateReads++
  }
  if (!published.has(pkg.name)) return new Response('missing', { status: 404 })
  if (path.endsWith('.tgz')) return new Response(corrupt ? new TextEncoder().encode('tampered public bytes') : published.get(pkg.name)!)
  if (path.endsWith(`/${pkg.version}`)) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: libraryIntegrity(published.get(pkg.name)!), tarball: `${server.url.origin}/${pkg.name}.tgz` } })
  return Response.json({ 'dist-tags': { alpha: channelAdvanced ? '9.0.0-alpha.1' : pkg.version } })
} })
try {
  await writeFile('.npmrc', `registry=${server.url.origin}\n//127.0.0.1:${server.port}/:_authToken=local-fixture-token\n`)
  process.env.NODE_AUTH_TOKEN = 'local-fixture-token'
  process.env.NPM_CONFIG_USERCONFIG = join(cwd, '.npmrc')
  // Simulate a later current verifier checkout; never execute source at the old tag.
  await writeFile('verifier.txt', 'current verifier')
  libraryReleaseGit(cwd, ['add', 'verifier.txt'])
  libraryReleaseGit(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'test: current verifier'])
  const verifier = libraryReleaseGit(cwd, ['rev-parse', 'HEAD'])
  const provider = (change: { jobs?: unknown[], artifacts?: unknown[], run?: unknown, zip?: Uint8Array } = {}) => async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.startsWith(server.url.origin)) return fetch(url, init)
    if (url.startsWith('https://fixture.blob.core.windows.net/')) {
      assert.equal((init?.headers as Record<string, string>)?.Authorization, undefined)
      return new Response(change.zip ?? zip)
    }
    const githubAuth = (init?.headers as Record<string, string>)?.Authorization
    assert.ok(githubAuth === undefined || githubAuth === 'Bearer read-only-fixture')
    if (url.endsWith('/321/zip')) return new Response(null, { status: 302, headers: { location: 'https://fixture.blob.core.windows.net/archive' } })
    if (url.includes('/jobs?')) return Response.json({ jobs: change.jobs ?? jobs })
    if (url.includes('/artifacts?')) return Response.json({ artifacts: change.artifacts ?? [artifact] })
    if (url.includes('/workflows/ci.yml/runs?')) return Response.json({ workflow_runs: [run] })
    if (url.endsWith('/runs/123')) return Response.json(change.run ?? run)
    throw new Error(`Unexpected provider request ${url}`)
  }
  // Full reruns retain the earlier same-name artifact. Select the newest one,
  // then bind its downloaded ownership record to the provider's current attempt.
  const owner = JSON.parse(await readFile(join(directory, 'ownership.json'), 'utf8'))
  await writeFile(join(directory, 'ownership.json'), JSON.stringify({ ...owner, runAttempt: 2 }))
  assert.equal(Bun.spawnSync(['zip', '-q', '-r', join(cwd, 'provider-rerun.zip'), '.'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' }).exitCode, 0)
  const rerunZip = await readFile(join(cwd, 'provider-rerun.zip'))
  const olderArtifact = { ...artifact, id: 320 }
  const rerunArtifact = { ...artifact, size_in_bytes: rerunZip.length, digest: `sha256:${librarySha256(rerunZip)}` }
  const rerun = { ...run, run_attempt: 2 }
  const rerunReceipt = await acceptNativeLibraryRelease({ cwd, directory: join(cwd, 'rerun-accepted'), tag: 'v1.0.0', runId: 123,
    fetch: provider({ run: rerun, artifacts: [olderArtifact, rerunArtifact], zip: rerunZip }) })
  assert.equal(rerunReceipt!.artifact.id, 321)
  assert.equal(rerunReceipt!.runAttempt, 2)
  await assert.rejects(acceptNativeLibraryRelease({ cwd, directory: join(cwd, 'rerun-wrong-owner'), tag: 'v1.0.0', runId: 123,
    fetch: provider({ run: rerun, artifacts: [olderArtifact, artifact] }) }), /Candidate ownership record differs/)
  let attempt = 0
  for (const changed of [
    { jobs: jobs.slice(0, 2) }, { jobs: [...jobs, jobs[0]] }, { jobs: jobs.map(job => ({ ...job, conclusion: 'skipped' })) },
    { artifacts: [artifact, artifact] }, { artifacts: [{ ...artifact, expired: true }] },
    { run: { ...run, head_repository: { id: 6, full_name: 'fork/libraries' } } },
    { zip: new Uint8Array(zip.length) },
  ]) {
    await assert.rejects(acceptNativeLibraryRelease({ cwd, directory: join(cwd, `rejected-${attempt++}`), tag: 'v1.0.0', runId: 123, fetch: provider(changed) }))
  }
  libraryReleaseGit(cwd, ['tag', 'v1.0.1'])
  await assert.rejects(acceptNativeLibraryRelease({ cwd, directory: join(cwd, 'wrong-tag'), tag: 'v1.0.1', runId: 123, fetch: provider() }))
  const acceptedDir = join(cwd, 'accepted')
  const receipt = await acceptNativeLibraryRelease({ cwd, directory: acceptedDir, tag: 'v1.0.0', token: 'read-only-fixture', fetch: provider() })
  assert.equal(receipt!.source.commit, source.commit)
  assert.equal(receipt!.source.tag, 'v1.0.0')
  assert.equal(receipt!.verifierCommit, verifier)
  // Neither publishing nor readback can rebuild from changed application sources.
  await writeFile('resources/functions/add.ts', 'this is deliberately invalid TypeScript')
  const anonymousOptions = { cwd, directory: acceptedDir, token: 'read-only-fixture', fetch: provider(), npmRegistry: server.url.origin }
  // Ambient write credentials must not be adopted for an overridden registry.
  await assert.rejects(publishNativeLibraryRelease(anonymousOptions), /Restricted packages require/)
  assert.equal(uploads, 0)
  assert.equal(registryReads, 0)
  const options = { ...anonymousOptions, readAuth: { registry: server.url.origin, token: 'local-read-token' } }
  await assert.rejects(publishNativeLibraryRelease({ ...options, readAuth: { registry: 'https://registry.npmjs.org', token: 'local-read-token' } }), /exact configured registry origin/)
  assert.equal(uploads, 0)
  // A changed self-consistent local candidate must still match the original ZIP.
  const record = await readFile(join(acceptedDir, 'candidate.json'), 'utf8')
  await writeFile(join(acceptedDir, 'candidate.json'), record.replace('"bun":', '"extra": true, "bun":'))
  await assert.rejects(publishNativeLibraryRelease(options), /differs from the owned provider artifact/)
  assert.equal(uploads, 0)
  await writeFile(join(acceptedDir, 'candidate.json'), record)
  // Model an interrupted mixed set: the first archive is already public.
  published.set(candidate.packages[0]!.name, originals[0]!)
  const result = await publishNativeLibraryRelease(options)
  assert.deepEqual(result.packages.map(pkg => pkg.status), ['existing-identical', 'published', 'published'])
  assert.equal(result.source.tag, 'v1.0.0')
  assert.equal(result.verifierCommit, verifier)
  assert.ok(privateReads > 0)
  assert.ok(!JSON.stringify(result).includes('local-read-token'))
  assert.ok(!JSON.stringify(result).includes('local-fixture-token'))
  assert.equal(uploads, 2)
  const retry = await publishNativeLibraryRelease(options)
  assert.deepEqual(retry.packages.map(pkg => pkg.status), ['existing-identical', 'existing-identical', 'existing-identical'])
  assert.equal(uploads, 2)
  const readback = await readbackNativeLibraryRelease(options)
  assert.equal(readback.source.commit, source.commit)
  assert.equal(readback.verifierCommit, verifier)
  assert.equal(readback.source.tag, 'v1.0.0')
  // Exercise the native wrapper's canonical environment binding without ever
  // contacting the public registry or giving readback a publisher capability.
  process.env.NPM_READ_TOKEN = 'local-read-token'
  let canonicalReads = 0
  const canonical = await readbackNativeLibraryRelease({ ...anonymousOptions, npmRegistry: undefined, fetch: async (url, init) => {
    if (!url.startsWith('https://registry.npmjs.org/')) return provider()(url, init)
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer local-read-token')
    assert.ok(!init?.method || init.method === 'GET')
    canonicalReads++
    const path = decodeURIComponent(new URL(url).pathname)
    const pkg = candidate.packages.find(pkg => path === `/${pkg.name}` || path === `/${pkg.name}/${pkg.version}` || path === `/${pkg.name}.tgz`)!
    assert.ok(pkg)
    if (path.endsWith('.tgz')) return new Response(published.get(pkg.name)!)
    if (path.endsWith(`/${pkg.version}`)) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: libraryIntegrity(published.get(pkg.name)!), tarball: `https://registry.npmjs.org/${pkg.name}.tgz` } })
    return Response.json({ 'dist-tags': { alpha: pkg.version } })
  } })
  assert.ok(canonicalReads > 0)
  assert.equal(canonical.source.commit, source.commit)
  assert.ok(!JSON.stringify(canonical).includes('local-read-token'))
  channelAdvanced = true
  const historicalTags = await readbackNativeLibraryRelease(options)
  assert.equal(historicalTags.packages[0]!.tags.alpha, '9.0.0-alpha.1')
  await assert.rejects(publishNativeLibraryRelease(options), /missing requested tag/)
  assert.equal(uploads, 2)
  assert.equal(await readFile('build-count', 'utf8'), 'x')
  corrupt = true
  await assert.rejects(publishNativeLibraryRelease(options), /archive bytes differ/)
  assert.equal(uploads, 2)
  corrupt = false
  const { configuredLibrary } = await import('../../src/library/packages')
  const current = (await configuredLibrary())!
  current.releaseable = false
  current.packages = []
  current.release = { ...current.release, distTag: 'latest' }
  const historicalDirectory = join(cwd, 'historical')
  const historical = await acceptNativeLibraryRelease({ cwd, directory: historicalDirectory, tag: 'v1.0.0', runId: 123, historical: true, fetch: provider() })
  assert.equal(historical!.source.commit, source.commit)
  const historicalOptions = { ...options, directory: historicalDirectory }
  await readbackNativeLibraryRelease(historicalOptions)
  await assert.rejects(publishNativeLibraryRelease(historicalOptions), /publication is disabled/)
  assert.equal(uploads, 2)
  console.log('Native library tag lifecycle passed')
}
finally { server.stop(true) }
