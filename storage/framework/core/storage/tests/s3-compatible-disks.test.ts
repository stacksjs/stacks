import { describe, expect, it } from 'bun:test'
import { backblazeDisk, hetznerDisk, r2Disk } from '../src/types/filesystem'

// Backblaze B2, Cloudflare R2 and Hetzner Object Storage are all S3-compatible,
// so they reuse the s3 adapter with the endpoint pinned to the service
// (stacksjs/stacks#1897, #1896). These presets make each a first-class disk.
describe('S3-compatible storage presets', () => {
  it('backblazeDisk pins the region into the endpoint', () => {
    expect(backblazeDisk('bucket', 'us-west-004')).toEqual({
      driver: 's3',
      bucket: 'bucket',
      region: 'us-west-004',
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      visibility: 'private',
    })
  })

  it('r2Disk uses the auto region and the per-account endpoint', () => {
    expect(r2Disk('bucket', 'abc123account')).toEqual({
      driver: 's3',
      bucket: 'bucket',
      region: 'auto',
      endpoint: 'https://abc123account.r2.cloudflarestorage.com',
      visibility: 'private',
    })
  })

  it('hetznerDisk uses the location as both region and endpoint host', () => {
    expect(hetznerDisk('bucket', 'fsn1')).toEqual({
      driver: 's3',
      bucket: 'bucket',
      region: 'fsn1',
      endpoint: 'https://fsn1.your-objectstorage.com',
      visibility: 'private',
    })
  })

  it('each accepts credentials and overrides', () => {
    const disk = r2Disk('assets', 'acct', {
      credentials: { key: 'R2_KEY', secret: 'R2_SECRET' },
      prefix: 'uploads/',
      visibility: 'public',
    })
    expect(disk.credentials).toEqual({ key: 'R2_KEY', secret: 'R2_SECRET' })
    expect(disk.prefix).toBe('uploads/')
    expect(disk.visibility).toBe('public')
    expect(disk.endpoint).toBe('https://acct.r2.cloudflarestorage.com')
  })
})
