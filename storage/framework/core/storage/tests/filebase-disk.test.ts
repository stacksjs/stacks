import { describe, expect, it } from 'bun:test'
import { filebaseDisk } from '../src/types/filesystem'

// Filebase is S3-compatible (IPFS-backed), so it reuses the s3 adapter with the
// endpoint pinned. filebaseDisk makes it a first-class preset (stacksjs/stacks#938).
describe('filebaseDisk', () => {
  it('presets an s3 disk pointed at the Filebase endpoint', () => {
    expect(filebaseDisk('my-bucket')).toEqual({
      driver: 's3',
      bucket: 'my-bucket',
      region: 'us-east-1',
      endpoint: 'https://s3.filebase.com',
      visibility: 'private',
    })
  })

  it('lets callers supply credentials and other overrides', () => {
    const disk = filebaseDisk('assets', {
      credentials: { key: 'FILEBASE_KEY', secret: 'FILEBASE_SECRET' },
      prefix: 'uploads/',
      visibility: 'public',
    })
    expect(disk.credentials).toEqual({ key: 'FILEBASE_KEY', secret: 'FILEBASE_SECRET' })
    expect(disk.prefix).toBe('uploads/')
    expect(disk.visibility).toBe('public')
    // Endpoint stays pinned to Filebase unless explicitly overridden.
    expect(disk.endpoint).toBe('https://s3.filebase.com')
    expect(disk.driver).toBe('s3')
  })

  it('allows overriding the endpoint (e.g. a regional/gateway mirror)', () => {
    expect(filebaseDisk('b', { endpoint: 'https://custom.filebase.example' }).endpoint)
      .toBe('https://custom.filebase.example')
  })
})
