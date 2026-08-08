import { describe, expect, it } from 'bun:test'
import { hetznerDisk } from '../src/types/filesystem'

// Hetzner Object Storage is S3-compatible with a per-location endpoint, so it
// reuses the s3 adapter. hetznerDisk makes it a first-class preset.
describe('hetznerDisk', () => {
  it('defaults to Falkenstein and resolves the location endpoint', () => {
    expect(hetznerDisk('nsdap-archive')).toEqual({
      driver: 's3',
      bucket: 'nsdap-archive',
      region: 'fsn1',
      endpoint: 'https://fsn1.your-objectstorage.com',
      usePathStyleEndpoint: true,
      visibility: 'private',
    })
  })

  it('resolves the endpoint from the chosen location', () => {
    expect(hetznerDisk('b', 'nbg1').endpoint).toBe('https://nbg1.your-objectstorage.com')
    expect(hetznerDisk('b', 'hel1').endpoint).toBe('https://hel1.your-objectstorage.com')
  })

  it('uses the location as the region, since Hetzner signs against it', () => {
    expect(hetznerDisk('b', 'hel1').region).toBe('hel1')
  })

  /**
   * Virtual-hosted-style puts the bucket in the hostname, and Hetzner's
   * certificate does not cover a bucket name containing a dot. Defaulting to
   * path-style keeps such a bucket usable instead of failing TLS at runtime.
   */
  it('defaults to path-style addressing', () => {
    expect(hetznerDisk('media.example.com').usePathStyleEndpoint).toBe(true)
  })

  it('lets callers supply credentials and other overrides', () => {
    const disk = hetznerDisk('assets', 'fsn1', {
      credentials: { key: 'HETZNER_KEY', secret: 'HETZNER_SECRET' },
      prefix: 'nara/',
      visibility: 'public',
    })

    expect(disk.credentials).toEqual({ key: 'HETZNER_KEY', secret: 'HETZNER_SECRET' })
    expect(disk.prefix).toBe('nara/')
    expect(disk.visibility).toBe('public')
    expect(disk.endpoint).toBe('https://fsn1.your-objectstorage.com')
  })

  it('allows overriding the endpoint and the path-style default', () => {
    const disk = hetznerDisk('b', 'fsn1', {
      endpoint: 'https://custom.hetzner.example',
      usePathStyleEndpoint: false,
    })

    expect(disk.endpoint).toBe('https://custom.hetzner.example')
    expect(disk.usePathStyleEndpoint).toBe(false)
  })
})
