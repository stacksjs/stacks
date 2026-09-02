import { describe, expect, it } from 'bun:test'
import { backblazeDisk, r2Disk } from '../src/types/filesystem'

/**
 * The S3-compatible presets, alongside `hetzner-disk.test.ts`.
 *
 * Each encodes one provider's endpoint format, and a typo in the template is
 * silent: the config is well-formed, the adapter is the right one, and the
 * failure surfaces at runtime as a host that does not resolve or a signature
 * that does not verify. `hetznerDisk` was already covered; `r2Disk` and
 * `backblazeDisk` were not (stacksjs/stacks#1896, #1897).
 */

describe('r2Disk', () => {
  it('builds the per-account endpoint and R2 single region', () => {
    expect(r2Disk('media', 'abc123')).toEqual({
      driver: 's3',
      bucket: 'media',
      region: 'auto',
      endpoint: 'https://abc123.r2.cloudflarestorage.com',
      visibility: 'private',
    })
  })

  /*
   * R2 has one logical region and signs against the literal string `auto`.
   * Sending a real AWS region name here produces a signature R2 rejects, so
   * this is pinned rather than left to look like a placeholder.
   */
  it('uses `auto` as the region, which is what R2 signs against', () => {
    expect(r2Disk('b', 'acct').region).toBe('auto')
  })

  it('takes the account id into the host, not the bucket', () => {
    // The bucket stays a bucket: R2 addresses it inside the account endpoint,
    // so a bucket name never reaches the hostname here.
    const disk = r2Disk('my.bucket.with.dots', 'acct')

    expect(disk.endpoint).toBe('https://acct.r2.cloudflarestorage.com')
    expect(disk.bucket).toBe('my.bucket.with.dots')
  })

  /*
   * R2 serves public objects only from a mapped custom domain or
   * `pub-<hash>.r2.dev`, never from the API host - so `publicUrl()` has to be
   * told, and the preset must not fabricate one from the endpoint.
   */
  it('does not invent a public URL, since the API host never serves one', () => {
    expect(r2Disk('b', 'acct').url).toBeUndefined()
    expect(r2Disk('b', 'acct', { url: 'https://cdn.example.com' }).url).toBe('https://cdn.example.com')
  })

  it('defaults to private and lets callers override', () => {
    expect(r2Disk('b', 'acct').visibility).toBe('private')

    const disk = r2Disk('b', 'acct', {
      credentials: { key: 'R2_KEY', secret: 'R2_SECRET' },
      prefix: 'uploads/',
      visibility: 'public',
    })

    expect(disk.credentials).toEqual({ key: 'R2_KEY', secret: 'R2_SECRET' })
    expect(disk.prefix).toBe('uploads/')
    expect(disk.visibility).toBe('public')
    expect(disk.endpoint).toBe('https://acct.r2.cloudflarestorage.com')
  })

  it('allows overriding the endpoint outright', () => {
    expect(r2Disk('b', 'acct', { endpoint: 'https://r2.example.test' }).endpoint).toBe('https://r2.example.test')
  })
})

describe('backblazeDisk', () => {
  it('embeds the region in the endpoint', () => {
    expect(backblazeDisk('backups', 'us-west-004')).toEqual({
      driver: 's3',
      bucket: 'backups',
      region: 'us-west-004',
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      visibility: 'private',
    })
  })

  it('resolves a different region into a different host', () => {
    expect(backblazeDisk('b', 'eu-central-003').endpoint).toBe('https://s3.eu-central-003.backblazeb2.com')
  })

  it('keeps the region and the endpoint in step, since B2 signs against it', () => {
    const disk = backblazeDisk('b', 'eu-central-003')

    expect(disk.endpoint).toContain(disk.region!)
  })

  it('lets callers supply credentials and other overrides', () => {
    const disk = backblazeDisk('b', 'us-west-004', {
      credentials: { key: 'B2_KEY_ID', secret: 'B2_APP_KEY' },
      visibility: 'public',
    })

    expect(disk.credentials).toEqual({ key: 'B2_KEY_ID', secret: 'B2_APP_KEY' })
    expect(disk.visibility).toBe('public')
    expect(disk.endpoint).toBe('https://s3.us-west-004.backblazeb2.com')
  })
})
