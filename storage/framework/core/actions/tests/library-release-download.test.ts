import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadLibraryReleaseSource, libraryArtifactZipFiles } from '../src/library/release-download'
import { librarySha256 } from '../src/library/release-artifacts'
import type { LibrarySourceReceipt } from '../src/library/release-source'

// Real provider-format ZIP bytes at the download boundary; provider transport
// is substituted so the test needs neither GitHub nor a publication token.
async function withZip(fn: (root: string, zip: Uint8Array) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'stacks-provider-zip-'))
  try {
    await mkdir(join(root, 'input'))
    await writeFile(join(root, 'input/candidate.json'), '{"schemaVersion":1}')
    await mkdir(join(root, 'input/archives'))
    await writeFile(join(root, 'input/archives/0.tgz'), new Uint8Array([0, 1, 2, 3]))
    const packed = Bun.spawnSync(['zip', '-q', '-r', join(root, 'provider.zip'), '.'], { cwd: join(root, 'input'), stdout: 'pipe', stderr: 'pipe' })
    expect(packed.exitCode).toBe(0)
    await fn(root, await readFile(join(root, 'provider.zip')))
  }
  finally { await rm(root, { recursive: true, force: true }) }
}
function receipt(zip: Uint8Array): LibrarySourceReceipt {
  return { schemaVersion: 1, source: { repository: 'fixture/libraries', commit: 'a'.repeat(40) }, runId: 123, runAttempt: 1, workflow: '.github/workflows/ci.yml', branch: 'main', requiredJobs: ['Lint', 'Typecheck', 'Test'], artifact: { id: 321, name: 'stacks-library-candidate', bytes: zip.length, expiresAt: '2099-01-01T00:00:00Z', digest: `sha256:${librarySha256(zip)}`, downloadUrl: 'https://api.github.com/repos/fixture/libraries/actions/artifacts/321/zip' } }
}

test('downloads only the accepted artifact, verifies provider digest and writes ordinary files', async () => withZip(async (root, zip) => {
  const requests: Array<{ url: string, auth: string | undefined }> = []
  await downloadLibraryReleaseSource(receipt(zip), join(root, 'accepted'), { token: 'read-only-fixture', fetch: async (url, init) => {
    requests.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization })
    return url.startsWith('https://api.github.com/') ? new Response(null, { status: 302, headers: { location: 'https://fixture.blob.core.windows.net/signed-artifact' } }) : new Response(zip)
  } })
  expect(requests).toEqual([
    { url: 'https://api.github.com/repos/fixture/libraries/actions/artifacts/321/zip', auth: 'Bearer read-only-fixture' },
    { url: 'https://fixture.blob.core.windows.net/signed-artifact', auth: undefined },
  ])
  expect(await readFile(join(root, 'accepted/archives/0.tgz'))).toEqual(Buffer.from([0, 1, 2, 3]))
}))

test('rejects missing or mismatched provider digest and unauthorized redirects before file writes', async () => withZip(async (root, zip) => {
  for (const mode of ['missing-digest', 'digest', 'length', 'redirect']) {
    const accepted = receipt(zip)
    if (mode === 'missing-digest') delete accepted.artifact.digest
    if (mode === 'digest') accepted.artifact.digest = `sha256:${'b'.repeat(64)}`
    if (mode === 'length') accepted.artifact.bytes++
    const directory = join(root, mode)
    await expect(downloadLibraryReleaseSource(accepted, directory, { fetch: async url => url.startsWith('https://api.github.com/')
      ? new Response(null, { status: 302, headers: { location: mode === 'redirect' ? 'https://untrusted.invalid/zip' : 'https://fixture.blob.core.windows.net/zip' } }) : new Response(zip) })).rejects.toThrow()
    expect(await Bun.file(join(directory, 'candidate.json')).exists()).toBe(false)
  }
}))

test('bounds ZIP entries and rejects traversal, duplicate files and symlinks', async () => withZip(async (root, zip) => {
  expect([...libraryArtifactZipFiles(zip).keys()].sort()).toEqual(['archives/0.tgz', 'candidate.json'])
  // Alter the central path without needing any unsafe filesystem fixture.
  for (const replacement of ['../escape.json', 'archives/0.tgz']) {
    const changed = Buffer.from(zip)
    const offset = changed.lastIndexOf(Buffer.from('candidate.json'))
    changed.write(replacement, offset)
    expect(() => libraryArtifactZipFiles(changed)).toThrow()
  }
  const linked = Buffer.from(await readFile(join(root, 'provider.zip')))
  const central = linked.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  linked.writeUInt32LE((0o120777 << 16) >>> 0, central + 38)
  expect(() => libraryArtifactZipFiles(linked)).toThrow('Unsupported')
  expect(() => libraryArtifactZipFiles(new Uint8Array([1, 2]))).toThrow()
}))
