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
  const providers: Array<[string, Record<string, unknown>]> = [
    ['R2', { bucket: 'assets', region: 'auto', endpoint: 'https://acct123.r2.cloudflarestorage.com' }],
    ['Hetzner', { bucket: 'assets', region: 'fsn1', endpoint: 'https://fsn1.your-objectstorage.com' }],
    ['Filebase', { bucket: 'assets', region: 'us-east-1', endpoint: 'https://s3.filebase.com' }],
  ]

  for (const [name, config] of providers) {
    it(`refuses to invent an AWS URL for ${name}`, async () => {
      const promise = adapter(config).publicUrl('img/logo.png')

      await expect(promise).rejects.toThrow(/no AWS public URL/)
      // The message has to name the endpoint, or the reader cannot tell which
      // of several disks is misconfigured.
      await expect(promise).rejects.toThrow(new RegExp(String(config.endpoint).replace(/[.]/g, '\\.')))
    })

    it(`uses the configured url for ${name}`, async () => {
      const url = await adapter({ ...config, url: 'https://cdn.example.com' }).publicUrl('img/logo.png')

      expect(url).toBe('https://cdn.example.com/img/logo.png')
    })
  }

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
