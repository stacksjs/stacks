import { afterAll, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { acceptedPublications } from './npm-publication'
import { publishVerifiedSample, sampleLibraryNames } from './publish-verified-sample'

const directory = await mkdtemp(join(tmpdir(), 'stacks-npm-sample-'))
afterAll(() => rm(directory, { recursive: true, force: true }))
const archive = join(directory, 'sample.tgz')
const identity = { name: '@stacksjs/hello-world-stx', version: '0.75.999' }
const bytes = new TextEncoder().encode('original archive bytes')
await Bun.write(archive, bytes)
const receipt = {
  ...identity,
  integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  shasum: createHash('sha1').update(bytes).digest('hex'),
}
const tarball = 'https://registry.npmjs.org/@stacksjs/hello-world-stx/-/sample.tgz'

function publicRegistry(visible = false) {
  const calls: string[] = []
  const read = async (url: string) => {
    calls.push(url)
    if (!visible) return new Response(null, { status: 404 })
    if (url === tarball) return new Response(bytes)
    return Response.json({ ...identity, dist: { tarball, integrity: receipt.integrity, shasum: receipt.shasum } })
  }
  return { calls, read, show: () => { visible = true } }
}

describe('verified npm sample', () => {
  it('discovers the sample for the prior-workflow receipt check', async () => {
    expect(await sampleLibraryNames(new URL('../../', import.meta.url).pathname)).toContain(identity.name)
  })

  it('uploads the original path once and reads back the complete public archive', async () => {
    const fixture = publicRegistry()
    let uploads = 0
    await publishVerifiedSample(archive, identity, { read: fixture.read, upload: async (path, dryRun) => {
      expect(await Bun.file(path).text()).toBe('original archive bytes')
      expect(dryRun).toBe(false)
      uploads++
      fixture.show()
      return { ok: true }
    } })
    expect(uploads).toBe(1)
    expect(fixture.calls.at(-1)).toBe(tarball)
  })

  it('reuses a prior verified receipt despite different local pack bytes', async () => {
    const fixture = publicRegistry(true)
    const replacement = join(directory, 'rebuilt.tgz')
    await Bun.write(replacement, 'different rebuilt bytes')
    const upload = async () => { throw new Error('retry must not upload') }
    const prior = acceptedPublications(`Publishing ${identity.name}@${identity.version}...\nIntegrity: ${receipt.integrity}\nShasum: ${receipt.shasum}\nUpload accepted; publication is pending public metadata`)
    await publishVerifiedSample(replacement, identity, { prior, read: fixture.read, upload })
    expect(fixture.calls.at(-1)).toBe(tarball)
    await expect(publishVerifiedSample(replacement, identity, { read: fixture.read, upload })).rejects.toThrow('differs from the verified archive')
  })

  it('recovers a lost acknowledgement through the original bytes without another upload', async () => {
    const fixture = publicRegistry()
    let uploads = 0
    await publishVerifiedSample(archive, identity, { read: fixture.read, upload: async () => {
      uploads++
      fixture.show()
      return { ok: false, code: 'ECONNRESET' }
    } })
    expect(uploads).toBe(1)
    expect(fixture.calls.at(-1)).toBe(tarball)
  })

  it('fails an explicit publisher rejection before treating an upload as accepted', async () => {
    const fixture = publicRegistry()
    await expect(publishVerifiedSample(archive, identity, { read: fixture.read, upload: async () => ({ ok: false, code: 'E404' }) })).rejects.toThrow("Check this package's publisher for release.yml.")
    expect(fixture.calls).toHaveLength(1)
  })

  it('dry-runs the original archive without registry readback', async () => {
    await publishVerifiedSample(archive, identity, { dryRun: true,
      read: async () => { throw new Error('dry run should not read back') },
      upload: async (path, dryRun) => {
        expect(path).toBe(archive)
        expect(dryRun).toBe(true)
        return { ok: true }
      },
    })
  })
})
