import { afterEach, describe, expect, it } from 'bun:test'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { checkForDesktopUpdate, compareVersions, sendDesktopInvites, stageDesktopUpdate, updateManifestPayload, validateUpdateManifest } from '../src/index'

const temporaryPaths: string[] = []
const signingKeys = generateKeyPairSync('ed25519')
const trustedKeys = {
  release: `ed25519-public:${signingKeys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')}`,
}

function signedManifest(overrides: Record<string, unknown> = {}) {
  const manifest = {
    version: '1.2.4',
    url: 'https://releases.example.com/app.zip',
    sha256: 'a'.repeat(64),
    size: 1,
    sourceRevision: 'a'.repeat(40),
    platform: process.platform,
    architecture: process.arch,
    signingKeyId: 'release',
    signature: '',
    ...overrides,
  }
  manifest.signature = sign(null, updateManifestPayload(manifest), signingKeys.privateKey).toString('base64url')
  return manifest
}

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map(target => rm(target, { force: true, recursive: true })))
})

describe('desktop invites and updates', () => {
  it('creates and sends one invite per recipient', async () => {
    const delivered: string[] = []
    const results = await sendDesktopInvites([
      'one@example.com',
      { email: 'two@example.com', team: 'framework', role: 'admin' },
    ], {
      baseUrl: 'app.example.com',
      createToken: recipient => `token-${recipient.email}`,
      send: ({ url }) => { delivered.push(url) },
    })

    expect(results.every(result => result.delivered)).toBeTrue()
    expect(delivered).toHaveLength(2)
    expect(new URL(delivered[1]!).searchParams.get('team')).toBe('framework')
  })

  it('isolates invalid recipients without cancelling the batch', async () => {
    const results = await sendDesktopInvites(['invalid', 'valid@example.com'], {
      baseUrl: 'app.example.com',
      createToken: () => 'token',
      send: () => {},
    })
    expect(results.map(result => result.delivered)).toEqual([false, true])
  })

  it('checks semantic versions and ignores current releases', async () => {
    const manifest = signedManifest()
    const fetcher = async () => Response.json(manifest)
    expect(await checkForDesktopUpdate({
      currentVersion: '1.2.3',
      manifestUrl: 'https://releases.example.com/stable.json',
      trustedKeys,
      fetcher,
    })).toEqual(manifest)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('stages verified updates atomically and rejects bad checksums', async () => {
    const payload = new TextEncoder().encode('desktop update')
    const sha256 = createHash('sha256').update(payload).digest('hex')
    const directory = path.join(tmpdir(), `desktop-update-${crypto.randomUUID()}`)
    const destination = path.join(directory, 'update.bin')
    temporaryPaths.push(directory)
    const manifest = signedManifest({ version: '2.0.0', url: 'https://releases.example.com/update.bin', sha256, size: payload.byteLength })
    const fetcher = async () => new Response(payload)

    const staged = await stageDesktopUpdate(manifest, destination, fetcher, trustedKeys)
    expect(staged.bytes).toBe(payload.byteLength)
    expect(await readFile(destination, 'utf8')).toBe('desktop update')
    const badChecksum = signedManifest({ ...manifest, sha256: '0'.repeat(64) })
    await expect(stageDesktopUpdate(badChecksum, destination, fetcher, trustedKeys)).rejects.toThrow('checksum mismatch')
  })

  it('rejects unsigned, modified, and unknown-key update manifests', async () => {
    const manifest = signedManifest()
    const fetcher = async () => Response.json(manifest)
    await expect(checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: 'https://releases.example.com/stable.json', fetcher, trustedKeys: {} }))
      .rejects.toThrow('not trusted')
    const modifiedFetcher = async () => Response.json({ ...manifest, version: '9.0.0' })
    await expect(checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: 'https://releases.example.com/stable.json', fetcher: modifiedFetcher, trustedKeys }))
      .rejects.toThrow('signature verification failed')
  })
})

// Security controls on the update path that had no coverage (stacksjs/stacks#2062):
// transport, downgrade, integrity, and signing-key validation are what make an
// update channel safe once real signing identities exist.
describe('desktop update security controls', () => {
  const stableUrl = 'https://releases.example.com/stable.json'

  it('requires HTTPS for the manifest URL outside loopback', async () => {
    await expect(checkForDesktopUpdate({
      currentVersion: '1.0.0',
      manifestUrl: 'http://releases.example.com/stable.json',
      trustedKeys,
      fetcher: async () => Response.json(signedManifest()),
    })).rejects.toThrow('HTTPS')
  })

  it('requires HTTPS for the download URL outside loopback', async () => {
    const manifest = signedManifest({ version: '2.0.0', url: 'http://releases.example.com/app.bin' })
    await expect(stageDesktopUpdate(manifest, path.join(tmpdir(), 'never-written.bin'), async () => new Response(new Uint8Array()), trustedKeys))
      .rejects.toThrow('HTTPS')
  })

  it('does not offer downgrades or equal versions', async () => {
    const older = signedManifest({ version: '1.0.0' })
    expect(await checkForDesktopUpdate({ currentVersion: '1.2.3', manifestUrl: stableUrl, trustedKeys, fetcher: async () => Response.json(older) })).toBeNull()
    const equal = signedManifest({ version: '1.2.3' })
    expect(await checkForDesktopUpdate({ currentVersion: '1.2.3', manifestUrl: stableUrl, trustedKeys, fetcher: async () => Response.json(equal) })).toBeNull()
  })

  it('rejects a size mismatch even when the checksum matches the delivered bytes', async () => {
    const payload = new TextEncoder().encode('abc')
    const sha256 = createHash('sha256').update(payload).digest('hex')
    const manifest = signedManifest({ version: '2.0.0', url: 'https://releases.example.com/app.bin', sha256, size: payload.byteLength + 1 })
    const directory = path.join(tmpdir(), `desktop-update-${crypto.randomUUID()}`)
    temporaryPaths.push(directory)
    await expect(stageDesktopUpdate(manifest, path.join(directory, 'u.bin'), async () => new Response(payload), trustedKeys))
      .rejects.toThrow('size mismatch')
  })

  it('refuses to stage without trusted signing keys', async () => {
    const manifest = signedManifest({ version: '2.0.0' })
    await expect(stageDesktopUpdate(manifest, path.join(tmpdir(), 'never-written.bin'), async () => new Response(new Uint8Array())))
      .rejects.toThrow('requires trusted signing keys')
  })

  it('rejects a signing key that is not ed25519-public: encoded', async () => {
    const rawKey = signingKeys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64url')
    await expect(checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: stableUrl, trustedKeys: { release: rawKey }, fetcher: async () => Response.json(signedManifest()) }))
      .rejects.toThrow('invalid encoding')
  })

  it('rejects a syntactically valid signature of the wrong length', async () => {
    const manifest = signedManifest()
    manifest.signature = Buffer.from(new Uint8Array(32)).toString('base64url') // canonical base64url, but not 64 bytes
    await expect(checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: stableUrl, trustedKeys, fetcher: async () => Response.json(manifest) }))
      .rejects.toThrow('signature verification failed')
  })

  it('enforces manifest schema before trusting any field', () => {
    expect(() => validateUpdateManifest({ ...signedManifest(), sha256: 'not-a-hash' })).toThrow('SHA-256')
    expect(() => validateUpdateManifest({ ...signedManifest(), size: -1 })).toThrow('non-negative')
    expect(() => validateUpdateManifest({ ...signedManifest(), sourceRevision: 'short' })).toThrow('source revision')
    expect(() => validateUpdateManifest({ ...signedManifest(), platform: 'solaris' })).toThrow('platform')
    expect(() => validateUpdateManifest({ ...signedManifest(), architecture: 'x86 64' })).toThrow('architecture')
  })
})

// Failed updates and builds for another target (stacksjs/stacks#2059).
describe('desktop update failures', () => {
  async function stagingDirectory(): Promise<string> {
    const directory = path.join(tmpdir(), `desktop-update-${crypto.randomUUID()}`)
    temporaryPaths.push(directory)
    return directory
  }

  function releaseOf(text: string, version: string) {
    const payload = new TextEncoder().encode(text)
    const manifest = signedManifest({
      version,
      url: `https://releases.example.com/${version}.bin`,
      sha256: createHash('sha256').update(payload).digest('hex'),
      size: payload.byteLength,
    })
    return { manifest, fetcher: async () => new Response(payload) }
  }

  it('refuses a manifest built for another platform or architecture, when checking and when staging', async () => {
    const elsewhere = signedManifest({ platform: process.platform === 'linux' ? 'darwin' : 'linux' })
    await expect(checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: 'https://releases.example.com/stable.json', trustedKeys, fetcher: async () => Response.json(elsewhere) }))
      .rejects.toThrow(`Desktop update is built for ${elsewhere.platform}-${process.arch}, not this app's ${process.platform}-${process.arch}`)

    const otherArch = signedManifest({ architecture: process.arch === 'arm64' ? 'x64' : 'arm64' })
    await expect(stageDesktopUpdate(otherArch, path.join(await stagingDirectory(), 'update.bin'), async () => new Response(new Uint8Array(1)), trustedKeys))
      .rejects.toThrow(`built for ${process.platform}-${otherArch.architecture}`)
  })

  it('checks against the target it is given, for a launcher acting for another build', async () => {
    const forArm = signedManifest({ platform: 'darwin', architecture: 'arm64' })
    expect(await checkForDesktopUpdate({ currentVersion: '1.0.0', manifestUrl: 'https://releases.example.com/stable.json', trustedKeys, fetcher: async () => Response.json(forArm), target: { platform: 'darwin', architecture: 'arm64' } }))
      .toEqual(forArm)
  })

  it('leaves the update staged before untouched when the next one fails, and no partial file behind', async () => {
    const directory = await stagingDirectory()
    const destination = path.join(directory, 'update.bin')
    const good = releaseOf('version two', '2.0.0')
    await stageDesktopUpdate(good.manifest, destination, good.fetcher, trustedKeys)

    const corrupted = releaseOf('version three', '3.0.0')
    await expect(stageDesktopUpdate(corrupted.manifest, destination, async () => new Response('version thre!'), trustedKeys)).rejects.toThrow('checksum mismatch')
    await expect(stageDesktopUpdate(corrupted.manifest, destination, async () => new Response('gone', { status: 503 }), trustedKeys)).rejects.toThrow('HTTP 503')
    await expect(stageDesktopUpdate(corrupted.manifest, destination, async () => { throw new TypeError('network down') }, trustedKeys)).rejects.toThrow('network down')

    expect(await readFile(destination, 'utf8')).toBe('version two')
    expect(await readdir(directory)).toEqual(['update.bin'])
  })

  it('removes its partial download when it cannot move it into place', async () => {
    const directory = await stagingDirectory()
    // A directory where the update should go: the rename fails after the write.
    const destination = path.join(directory, 'update.bin')
    await mkdir(path.join(destination, 'occupied'), { recursive: true })
    const release = releaseOf('version two', '2.0.0')

    await expect(stageDesktopUpdate(release.manifest, destination, release.fetcher, trustedKeys)).rejects.toThrow()
    expect(await readdir(directory)).toEqual(['update.bin'])
  })
})
