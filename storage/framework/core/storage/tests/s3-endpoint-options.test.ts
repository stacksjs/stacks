import { describe, expect, it } from 'bun:test'
import { resolveS3ClientOptions } from '../src/adapters/s3'

// This helper is what actually routes the S3 adapter to S3-compatible providers
// (Filebase/B2/R2/Hetzner). Without it the endpoint from the disk presets was
// dropped and every request hit AWS (stacksjs/stacks#938, #1897, #1896).
describe('resolveS3ClientOptions', () => {
  it('returns undefined for a plain AWS config (no endpoint/creds)', () => {
    expect(resolveS3ClientOptions({})).toBeUndefined()
  })

  it('strips the scheme and trailing slash (ts-cloud wants a bare host)', () => {
    expect(resolveS3ClientOptions({ endpoint: 'https://s3.filebase.com' })).toEqual({ endpoint: 's3.filebase.com' })
    expect(resolveS3ClientOptions({ endpoint: 'https://s3.us-west-004.backblazeb2.com/' }))
      .toEqual({ endpoint: 's3.us-west-004.backblazeb2.com' })
    expect(resolveS3ClientOptions({ endpoint: 'http://localhost:9000' })).toEqual({ endpoint: 'localhost:9000' })
  })

  it('passes forcePathStyle when requested', () => {
    expect(resolveS3ClientOptions({ endpoint: 'https://x.example', usePathStyleEndpoint: true }))
      .toEqual({ endpoint: 'x.example', forcePathStyle: true })
  })

  it('passes credentials through unchanged', () => {
    expect(resolveS3ClientOptions({ credentials: { accessKeyId: 'A', secretAccessKey: 'S' } }))
      .toEqual({ credentials: { accessKeyId: 'A', secretAccessKey: 'S' } })
  })

  it('combines endpoint + credentials (the real R2 shape)', () => {
    expect(resolveS3ClientOptions({
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'A', secretAccessKey: 'S' },
    })).toEqual({
      endpoint: 'acct.r2.cloudflarestorage.com',
      credentials: { accessKeyId: 'A', secretAccessKey: 'S' },
    })
  })
})
