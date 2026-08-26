import { describe, expect, it } from 'bun:test'
import { resolveS3ClientOptions } from '../src/adapters/s3'

// This helper is what actually routes the S3 adapter to S3-compatible providers
// (Filebase/B2/R2/Hetzner). Without it the endpoint from the disk presets was
// dropped and every request hit AWS (stacksjs/stacks#938, #1897, #1896).
describe('resolveS3ClientOptions', () => {
  it('returns undefined for a plain AWS config (no endpoint/creds)', () => {
    expect(resolveS3ClientOptions({})).toBeUndefined()
  })

  it('strips https and the trailing slash, since a bare host is served over TLS', () => {
    expect(resolveS3ClientOptions({ endpoint: 'https://s3.filebase.com' })).toEqual({ endpoint: 's3.filebase.com' })
    expect(resolveS3ClientOptions({ endpoint: 'https://s3.us-west-004.backblazeb2.com/' }))
      .toEqual({ endpoint: 's3.us-west-004.backblazeb2.com' })
  })

  // Regression. http:// used to be stripped alongside https://, which threw
  // away the only thing distinguishing a plaintext endpoint: ts-cloud then
  // connected to https://localhost:9000 and failed outright. That made MinIO,
  // and every other local or self-hosted S3 endpoint, unreachable through this
  // adapter - and made the adapter impossible to test without a cloud account.
  it('keeps http, which is the only marker of a plaintext endpoint', () => {
    expect(resolveS3ClientOptions({ endpoint: 'http://localhost:9000' }))
      .toEqual({ endpoint: 'http://localhost:9000' })
    expect(resolveS3ClientOptions({ endpoint: 'http://127.0.0.1:9100/' }))
      .toEqual({ endpoint: 'http://127.0.0.1:9100' })
  })

  it('leaves a bare host alone, whichever way it was given', () => {
    expect(resolveS3ClientOptions({ endpoint: 'fsn1.your-objectstorage.com' }))
      .toEqual({ endpoint: 'fsn1.your-objectstorage.com' })
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
