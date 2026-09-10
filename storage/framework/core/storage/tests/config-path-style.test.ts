import { describe, expect, it } from 'bun:test'
import { filebaseDisk, gcsDisk, hetznerDisk, r2Disk } from '../src/types/filesystem'

/**
 * `s3.usePathStyleEndpoint` in `config/filesystems.ts` is honoured
 * (stacksjs/stacks#266).
 *
 * It is documented on `FilesystemsConfig` and `buildConfig` never read it -
 * it hardcoded `!!s3Config.endpoint`, so every custom endpoint got path-style
 * forced on it. Right for Hetzner and MinIO, wrong for Filebase, R2 and GCS.
 *
 * Worse, it made the two ways of configuring one provider disagree:
 * `filebaseDisk()` leaves the flag unset (virtual-hosted, which is what
 * Filebase serves), while the same provider configured through
 * `config/filesystems.ts` got path-style.
 *
 * The resolution is asserted here as a pure expression rather than by booting
 * the facade, which reads real config and would test the environment instead.
 */
function resolvePathStyle(s3: { endpoint?: string, usePathStyleEndpoint?: boolean }): boolean {
  return s3.usePathStyleEndpoint ?? !!s3.endpoint
}

describe('s3 path-style resolution', () => {
  it('defaults to path style when a custom endpoint is set', () => {
    // Unchanged behaviour: several S3-compatible providers require it, and
    // this is what every existing configuration relies on.
    expect(resolvePathStyle({ endpoint: 'https://fsn1.your-objectstorage.com' })).toBeTrue()
  })

  it('defaults to virtual-hosted for AWS, which has no custom endpoint', () => {
    expect(resolvePathStyle({})).toBeFalse()
  })

  it('lets an explicit false win over a custom endpoint', () => {
    // This is the case that was impossible: Filebase, R2 and GCS all serve
    // virtual-hosted style from a custom endpoint.
    expect(resolvePathStyle({ endpoint: 'https://s3.filebase.com', usePathStyleEndpoint: false })).toBeFalse()
  })

  it('lets an explicit true win with no endpoint', () => {
    expect(resolvePathStyle({ usePathStyleEndpoint: true })).toBeTrue()
  })
})

describe('the disk presets agree with that resolution', () => {
  it('leaves Filebase, R2 and GCS virtual-hosted', () => {
    // Unset means virtual-hosted, and these three providers serve it. If the
    // config path forced path style, the same provider behaved differently
    // depending on which way it was configured.
    for (const disk of [filebaseDisk('b'), r2Disk('b', 'acct'), gcsDisk('b')])
      expect(disk.usePathStyleEndpoint).toBeUndefined()
  })

  it('pins Hetzner to path style, and says why in its own config', () => {
    // Hetzner's wildcard certificate covers one label, so a bucket name with a
    // dot fails TLS verification under virtual-hosted style.
    expect(hetznerDisk('media').usePathStyleEndpoint).toBeTrue()
  })

  it('points Filebase at its single S3 region and endpoint', () => {
    const disk = filebaseDisk('my-bucket')
    expect(disk.driver).toBe('s3')
    expect(disk.endpoint).toBe('https://s3.filebase.com')
    expect(disk.region).toBe('us-east-1')
    expect(disk.visibility).toBe('private')
  })

  it('lets any field be overridden', () => {
    expect(filebaseDisk('b', { prefix: 'uploads', visibility: 'public' }).prefix).toBe('uploads')
    expect(filebaseDisk('b', { usePathStyleEndpoint: true }).usePathStyleEndpoint).toBeTrue()
  })
})
