/**
 * `publicUrl()` must never name a host the disk is not on.
 *
 * The AWS host used to be the unconditional fallback, so every S3-COMPATIBLE
 * disk got a URL pointing at Amazon:
 *
 *   R2       -> https://assets.s3.auto.amazonaws.com/img/logo.png
 *   Hetzner  -> https://assets.s3.fsn1.amazonaws.com/img/logo.png
 *   Filebase -> https://assets.s3.us-east-1.amazonaws.com/img/logo.png
 *
 * `s3.auto.amazonaws.com` is not even a region that exists. Nothing throws and
 * nothing logs: the string is well-formed, so it goes into an `<img src>`, an
 * email, or a database column, and surfaces as a broken image for a viewer
 * some time later.
 *
 * It must also never throw: `Storage.put()` returns a `url` on every upload,
 * so a `publicUrl` that can fail turns a bad URL into a failed upload — the
 * more important operation, and a worse regression than the bug.
 *
 * stacksjs/stacks#1896.
 */

import { describe, expect, it } from 'bun:test'
import { S3StorageAdapter } from '../src/adapters/s3'
import { backblazeDisk, filebaseDisk, hetznerDisk, r2Disk, s3Disk } from '../src/types/filesystem'

function adapter(config: Record<string, unknown>): S3StorageAdapter {
  return new S3StorageAdapter(null, config as any)
}

describe('publicUrl on AWS', () => {
  it('still builds the AWS host for a disk that is actually on AWS', async () => {
    const url = await adapter({ bucket: 'assets', region: 'us-west-2' }).publicUrl('img/logo.png')

    expect(url).toBe('https://assets.s3.us-west-2.amazonaws.com/img/logo.png')
  })

  it('applies the disk prefix', async () => {
    const url = await adapter({ bucket: 'assets', region: 'eu-west-1', prefix: 'uploads' }).publicUrl('logo.png')

    expect(url).toBe('https://assets.s3.eu-west-1.amazonaws.com/uploads/logo.png')
  })
})

describe('publicUrl on an S3-compatible provider', () => {
  const providers: Array<[string, Record<string, unknown>, string]> = [
    [
      'R2',
      { bucket: 'assets', region: 'auto', endpoint: 'https://acct123.r2.cloudflarestorage.com' },
      'https://assets.acct123.r2.cloudflarestorage.com/img/logo.png',
    ],
    [
      'Filebase',
      { bucket: 'assets', region: 'us-east-1', endpoint: 'https://s3.filebase.com' },
      'https://assets.s3.filebase.com/img/logo.png',
    ],
    [
      'Hetzner (path-style)',
      { bucket: 'assets', region: 'fsn1', endpoint: 'https://fsn1.your-objectstorage.com', usePathStyleEndpoint: true },
      'https://fsn1.your-objectstorage.com/assets/img/logo.png',
    ],
  ]

  for (const [name, config, expected] of providers) {
    it(`derives ${name} from its own endpoint, never an AWS host`, async () => {
      const url = await adapter(config).publicUrl('img/logo.png')

      expect(url).toBe(expected)
      expect(url).not.toContain('amazonaws.com')
    })

    it(`prefers the configured url for ${name}`, async () => {
      const url = await adapter({ ...config, url: 'https://cdn.example.com' }).publicUrl('img/logo.png')

      expect(url).toBe('https://cdn.example.com/img/logo.png')
    })
  }

  it('never throws, because Storage.put() returns a url on every upload', async () => {
    // The first shape of this fix threw when it could not build a public URL,
    // which turned a bad URL into a FAILED UPLOAD in `put-file.ts` — a worse
    // regression than the bug, on the more important operation.
    const url = await adapter({ bucket: 'assets', endpoint: 'https://s3.filebase.com' }).publicUrl('x.png')

    expect(typeof url).toBe('string')
  })

  it('lets an explicit domain win over the configured url', async () => {
    const url = await adapter({
      bucket: 'assets',
      endpoint: 'https://s3.filebase.com',
      url: 'https://cdn.example.com',
    }).publicUrl('logo.png', { domain: 'https://other.example.com' })

    expect(url).toBe('https://other.example.com/logo.png')
  })

  it('does not double the slash when a base url has a trailing one', async () => {
    const url = await adapter({
      bucket: 'assets',
      endpoint: 'https://s3.filebase.com',
      url: 'https://cdn.example.com/',
    }).publicUrl('logo.png')

    expect(url).toBe('https://cdn.example.com/logo.png')
  })

  it('applies the disk prefix to a derived URL too', async () => {
    const url = await adapter({
      bucket: 'assets',
      endpoint: 'https://s3.filebase.com',
      prefix: 'uploads',
    }).publicUrl('logo.png')

    expect(url).toBe('https://assets.s3.filebase.com/uploads/logo.png')
  })
})

describe('the disk presets', () => {
  // Each preset pins an endpoint, so each one produced a wrong public URL.
  it('every S3-compatible preset carries an endpoint, and so needs a url', () => {
    const presets = [
      r2Disk('assets', 'acct123'),
      hetznerDisk('assets'),
      filebaseDisk('assets'),
      backblazeDisk('assets', 'us-west-004'),
    ]

    for (const preset of presets)
      expect(preset.endpoint).toBeTruthy()
  })

  it('a plain s3 disk has no endpoint, so the AWS host stays correct for it', () => {
    expect(s3Disk('assets').endpoint).toBeUndefined()
  })
})
