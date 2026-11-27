import { describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { backfillUmbrella, originalReleaseEvidence, pantryUmbrellaDigest, retainedUmbrella } from './npm-umbrella-backfill'

const version = '0.75.709'
const sha = '1'.repeat(40)
const repo = 'stacksjs/stacks'
const runId = 24
const bytes = 'original umbrella archive'
const digest = createHash('sha256').update(bytes).digest('hex')
const receipt = { name: 'stacks', version, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, shasum: createHash('sha1').update(bytes).digest('hex') }
const pantryUrl = `https://pantry.dev/packages/stacks/${version}/tarball`
const pantryLog = (artifactSha256 = digest) => `2026-11-27T20:46:37.2707198Z ${JSON.stringify({ success: true, message: `Published stacks@${version}`, visibility: 'public', scan: { verdict: 'clean', artifactSha256 } })}`
const npmLog = `Publishing @stacksjs/support@${version}...\nIntegrity: ${receipt.integrity}\nShasum: ${receipt.shasum}\n✓ Published @stacksjs/support@${version} with provenance`
const releaseRun = { id: runId, repository: { full_name: repo }, head_repository: { full_name: repo }, path: '.github/workflows/release.yml', head_branch: `v${version}`, head_sha: sha, event: 'push', status: 'completed', run_attempt: 1 }
const job = { run_id: runId, run_attempt: 1, head_sha: sha, status: 'completed', conclusion: 'success' }
const originalJobs = [
  { ...job, id: 1, name: 'accept exact release source CI' },
  { ...job, id: 2, name: 'release gate' },
  { ...job, id: 3, name: 'publish', conclusion: 'failure', steps: [{ name: 'Verify Pantry publication', conclusion: 'success' }] },
]

function evidenceFixture(run = releaseRun, jobs = originalJobs, log = `${pantryLog()}\n${npmLog}`) {
  return originalReleaseEvidence({ version, runId, sha, scoped: new Set(['@stacksjs/support']), samples: new Set(), async read(endpoint) {
    if (endpoint.endsWith(`/runs/${runId}`)) return JSON.stringify(run)
    if (endpoint.includes('/attempts/1/jobs')) return JSON.stringify({ total_count: jobs.length, jobs })
    if (endpoint.endsWith('/jobs/3/logs')) return log
    throw new Error(`Unexpected fixture endpoint ${endpoint}`)
  } })
}

describe('original release evidence', () => {
  it('retains the accepted archive and every exact scoped receipt from the original release', async () => {
    expect(await evidenceFixture()).toEqual({ digest, receipts: [{ ...receipt, name: '@stacksjs/support' }] })
  })

  it('rejects an unrelated workflow, tag or repository', async () => {
    for (const altered of [{ path: '.github/workflows/ci.yml' }, { head_sha: '2'.repeat(40) }, { head_branch: 'main' }, { head_repository: { full_name: 'other/stacks' } }])
      await expect(evidenceFixture({ ...releaseRun, ...altered })).rejects.toThrow('does not match the completed tagged release')
  })

  it('requires original gates, complete scoped coverage and one Pantry digest', async () => {
    await expect(evidenceFixture(releaseRun, originalJobs.slice(1))).rejects.toThrow('successful exact-source and release gates')
    await expect(evidenceFixture(releaseRun, originalJobs, pantryLog())).rejects.toThrow('every scoped package')
    expect(() => pantryUmbrellaDigest(`${pantryLog()}\n${pantryLog('2'.repeat(64))}`, version)).toThrow('Conflicting')
  })

  it('compares downloaded bytes with both the original and registry archive digests', async () => {
    const read = (archive: string) => async (url: string) => url === pantryUrl ? new Response(archive) : Response.json({ name: 'stacks', version, tarballUrl: pantryUrl, checksum: `sha256:${digest}`, integrity: receipt.integrity })
    expect((await retainedUmbrella(version, digest, read(bytes))).receipt).toEqual(receipt)
    await expect(retainedUmbrella(version, digest, read('different archive'))).rejects.toThrow('does not match the original bytes')
    await expect(retainedUmbrella(version, '2'.repeat(64), read(bytes))).rejects.toThrow('metadata does not match')
  })
})

describe('npm umbrella publication', () => {
  const tag = `backfill-${version}`
  const tarball = 'https://registry.npmjs.org/stacks/-/stacks-0.75.709.tgz'
  function registryFixture() {
    const state = { latest: '0.75.711', current: undefined as string | undefined, published: false, integrity: receipt.integrity }
    const read = async (url: string) => {
      if (url.endsWith('/dist-tags')) return Response.json({ latest: state.latest, [tag]: state.current })
      if (url === tarball) return new Response(bytes)
      if (!state.published) return new Response(null, { status: 404 })
      return Response.json({ name: 'stacks', version, dist: { tarball, integrity: state.integrity, shasum: receipt.shasum } })
    }
    return { state, read }
  }

  it('dry-runs without a live upload while stable latest is newer', async () => {
    const { read } = registryFixture()
    const uploads: [string, boolean][] = []
    expect(await backfillUmbrella(receipt, { publish: false, mayUpload: true, read, async upload(...args) { uploads.push(args) } })).toBe('dry-run')
    expect(uploads).toEqual([[tag, true]])
  })

  it('sends a single backfill upload, verifies bytes and tags, and accepts an idempotent retry', async () => {
    const { state, read } = registryFixture()
    const uploads: [string, boolean][] = []
    const options = { publish: true, mayUpload: true, read, async upload(...args: [string, boolean]) {
      uploads.push(args)
      state.published = true
      state.current = version
      state.latest = '0.75.712'
    } }
    expect(await backfillUmbrella(receipt, options)).toBe('verified')
    expect(await backfillUmbrella(receipt, { ...options, mayUpload: false })).toBe('verified')
    expect(uploads).toEqual([[tag, false]])
  })

  it('refuses stale or unexpected npm state and never uploads during a verification-only retry', async () => {
    const { state, read } = registryFixture()
    const options = { publish: true, mayUpload: false, read, budgetMs: 8, pollMs: 1, async upload() { throw new Error('Unexpected upload') } }
    await expect(backfillUmbrella(receipt, options)).rejects.toThrow('still pending')
    state.current = '0.75.710'
    await expect(backfillUmbrella(receipt, options)).rejects.toThrow('already points at another version')
    state.current = version
    state.published = true
    state.integrity = 'mismatch'
    await expect(backfillUmbrella(receipt, options)).rejects.toThrow('differs from the original Pantry archive')
    state.latest = version
    await expect(backfillUmbrella(receipt, options)).rejects.toThrow('requires a newer stable')
  })

  it('fails readback if stable latest regresses after an acknowledged upload', async () => {
    const { state, read } = registryFixture()
    await expect(backfillUmbrella(receipt, { publish: true, mayUpload: true, read, async upload() {
      state.published = true
      state.current = version
      state.latest = version
    } })).rejects.toThrow('latest tag regressed')
  })

  it('gates the public job on an explicit main workflow dispatch and defaults to dry-run', async () => {
    const yaml = await Bun.file(new URL('../workflows/release.yml', import.meta.url)).text()
    const workflow = Bun.YAML.parse(yaml) as any
    const backfill = workflow.jobs['npm-backfill']
    expect(workflow.on.workflow_dispatch.inputs.npm_backfill_publish.default).toBe(false)
    expect(backfill.if).toBe("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.npm_backfill_version != ''")
    expect(backfill.permissions).toEqual({ actions: 'read', contents: 'read', 'id-token': 'write' })
    expect(JSON.stringify(backfill)).not.toContain('secrets.NPM_TOKEN')
  })
})
