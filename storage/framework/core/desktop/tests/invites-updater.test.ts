import { afterEach, describe, expect, it } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { checkForDesktopUpdate, compareVersions, sendDesktopInvites, stageDesktopUpdate } from '../src/index'

const temporaryPaths: string[] = []

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
      send: ({ url }) => delivered.push(url),
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
    const manifest = {
      version: '1.2.4',
      url: 'https://releases.example.com/app.zip',
      sha256: 'a'.repeat(64),
    }
    const fetcher = async () => Response.json(manifest)
    expect(await checkForDesktopUpdate({
      currentVersion: '1.2.3',
      manifestUrl: 'https://releases.example.com/stable.json',
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
    const manifest = {
      version: '2.0.0',
      url: 'https://releases.example.com/update.bin',
      sha256,
      size: payload.byteLength,
    }
    const fetcher = async () => new Response(payload)

    const staged = await stageDesktopUpdate(manifest, destination, fetcher)
    expect(staged.bytes).toBe(payload.byteLength)
    expect(await readFile(destination, 'utf8')).toBe('desktop update')
    await expect(stageDesktopUpdate({ ...manifest, sha256: '0'.repeat(64) }, destination, fetcher))
      .rejects.toThrow('checksum mismatch')
  })
})
