import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { librarySha256 } from '../../src/library/release-artifacts'
import { acceptNativeLibraryRelease, libraryReleaseGit, prepareNativeLibraryRelease, publishNativeLibraryRelease } from '../../src/library/release-lifecycle'
import { planNativeLibraryRelease } from '../../src/library/release-plan'

const cwd = process.cwd()
assert.equal((await Bun.file('package.json').json()).name, 'release-version-fixture')
if (process.argv[2] === 'plan') {
  const byType = await planNativeLibraryRelease({ cwd, bump: 'preminor', preid: 'beta' })
  const byVersion = await planNativeLibraryRelease({ cwd, bump: '1.1.0-beta.0' })
  const config = { repository: 'fixture/libraries', release: { publisher: 'bun' as const }, packages: [{ name: '@fixture/math', registry: 'npm' as const }] }
  const requiredChannels: boolean[] = []
  for (const packages of [config.packages, [{ ...config.packages[0]!, version: '2.0.0-beta.1' }], [{ ...config.packages[0]!, version: '2.0.0' }, { ...config.packages[0]!, name: '@fixture/other' }]]) {
    await assert.rejects(planNativeLibraryRelease({ cwd, config: { ...config, packages }, bump: 'preminor', preid: 'beta' }), /non-latest distribution tag/)
    requiredChannels.push(true)
  }
  const allowedPrerelease = await planNativeLibraryRelease({ cwd, bump: 'preminor', preid: 'beta', config: { ...config, release: { ...config.release, distTag: 'beta' }, packages: [{ ...config.packages[0]!, version: '2.0.0' }, { ...config.packages[0]!, name: '@fixture/other' }] } })
  console.log(JSON.stringify({ byType: { version: byType!.packages[0]!.version, tag: byType!.tag }, byVersion: { version: byVersion!.packages[0]!.version, tag: byVersion!.tag }, requiredChannels, allowedPrerelease }))
}
else {
  const source = { repository: 'fixture/libraries', commit: libraryReleaseGit(cwd, ['rev-parse', 'HEAD']) }
  const directory = join(cwd, 'candidate')
  const prepared = await prepareNativeLibraryRelease({ cwd, directory, runId: 123, runAttempt: 1, branch: 'main' })
  assert.equal(prepared.prepared, true)
  if (!prepared.prepared) throw new Error('Expected a retained candidate')
  const pkg = prepared.candidate.packages[0]!
  const archive = await readFile(join(directory, pkg.archive.path))
  libraryReleaseGit(cwd, ['tag', 'v1.0.0'])
  assert.equal(Bun.spawnSync(['zip', '-q', '-r', join(cwd, 'source.zip'), '.'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' }).exitCode, 0)
  const zip = await readFile(join(cwd, 'source.zip'))
  const run = { id: 123, run_attempt: 1, head_sha: source.commit, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success', repository: { id: 5, full_name: source.repository }, head_repository: { id: 5, full_name: source.repository } }
  const artifact = { id: 321, name: 'stacks-library-candidate', expired: false, size_in_bytes: zip.length, expires_at: '2099-01-01T00:00:00Z', digest: `sha256:${librarySha256(zip)}`, workflow_run: { id: 123, repository_id: 5, head_repository_id: 5, head_sha: source.commit } }
  let gets = 0, writes = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (request.method !== 'GET') { writes++; return new Response('Writes forbidden', { status: 405 }) }
    gets++
    const path = decodeURIComponent(new URL(request.url).pathname)
    if (path === '/archive.tgz') return new Response(archive)
    if (path.endsWith(`/${pkg.version}`)) return Response.json({ name: pkg.name, version: pkg.version, dist: { integrity: pkg.archive.integrity, tarball: `${server.url.origin}/archive.tgz` } })
    return Response.json({ 'dist-tags': { latest: pkg.version } })
  } })
  assert.equal(server.url.hostname, '127.0.0.1')
  const provider = async (url: string, init?: RequestInit): Promise<Response> => {
    if (new URL(url).origin === server.url.origin) return fetch(url, init)
    if (url === 'https://fixture.blob.core.windows.net/archive') return new Response(zip)
    if (url === 'https://api.github.com/repos/fixture/libraries/actions/artifacts/321/zip') return new Response(null, { status: 302, headers: { location: 'https://fixture.blob.core.windows.net/archive' } })
    if (url.includes('/jobs?')) return Response.json({ jobs: ['Lint', 'Typecheck', 'Test'].map(name => ({ name, status: 'completed', conclusion: 'success' })) })
    if (url.includes('/artifacts?')) return Response.json({ artifacts: [artifact] })
    if (url === 'https://api.github.com/repos/fixture/libraries/actions/runs/123') return Response.json(run)
    throw new Error('Unexpected non-local request blocked')
  }
  try {
    const accepted = join(cwd, 'accepted')
    await acceptNativeLibraryRelease({ cwd, directory: accepted, tag: 'v1.0.0', runId: 123, fetch: provider })
    const options = { cwd, directory: accepted, fetch: provider, npmRegistry: server.url.origin, execute: async () => { throw new Error('Publisher execution forbidden in existing-archive fixture') } }
    const receipt = await publishNativeLibraryRelease(options)
    assert.equal(writes, 0)
    console.log(JSON.stringify({ version: pkg.version, tag: pkg.tag, status: receipt.packages[0]!.status, gets, writes }))
  }
  finally { server.stop(true) }
}
