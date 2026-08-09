import { describe, expect, it, mock } from 'bun:test'
import { ensureBucket } from '../src/provision'

/**
 * `ensureBucket` talks to a provider, so these stub `@stacksjs/ts-cloud` and
 * assert the decisions the function itself makes: when it creates, when it
 * reports an existing bucket, and which failures are benign.
 */
function stubTsCloud(client: Record<string, any>) {
  mock.module('@stacksjs/ts-cloud', () => ({
    createObjectStorageClient: () => client,
    resolveObjectStorage: () => ({
      provider: 'hetzner',
      region: 'fsn1',
      endpoint: 'fsn1.your-objectstorage.com',
      forcePathStyle: true,
      publicBaseUrl: (b: string) => `https://${b}.fsn1.your-objectstorage.com`,
    }),
  }))
}

describe('ensureBucket', () => {
  it('creates a bucket that does not exist', async () => {
    const created: string[] = []
    stubTsCloud({
      bucketExists: async () => false,
      createBucket: async (b: string) => { created.push(b) },
    })

    const result = await ensureBucket('nsdap-archive')

    expect(result.status).toBe('created')
    expect(created).toEqual(['nsdap-archive'])
    expect(result.publicUrl).toBe('https://nsdap-archive.fsn1.your-objectstorage.com')
  })

  it('reports an existing bucket without creating it', async () => {
    let createCalls = 0
    stubTsCloud({
      bucketExists: async () => true,
      createBucket: async () => { createCalls++ },
    })

    expect((await ensureBucket('nsdap-archive')).status).toBe('exists')
    expect(createCalls).toBe(0)
  })

  /**
   * Two instances booting at once both see "missing" and both create. The
   * loser of that race must not crash: the bucket it wanted now exists, which
   * is the outcome it asked for.
   */
  it('treats a lost creation race as success', async () => {
    stubTsCloud({
      bucketExists: async () => false,
      createBucket: async () => { throw new Error('BucketAlreadyOwnedByYou: already exists') },
    })

    expect((await ensureBucket('nsdap-archive')).status).toBe('exists')
  })

  it('surfaces a real failure with the provider named', async () => {
    stubTsCloud({
      bucketExists: async () => false,
      createBucket: async () => { throw new Error('AccessDenied') },
    })

    expect(ensureBucket('nsdap-archive')).rejects.toThrow(/hetzner.*AccessDenied/)
  })

  it('refuses an empty bucket name rather than asking the provider', async () => {
    stubTsCloud({
      bucketExists: async () => { throw new Error('should not be called') },
      createBucket: async () => {},
    })

    expect(ensureBucket('')).rejects.toThrow(/requires a bucket name/)
  })
})
