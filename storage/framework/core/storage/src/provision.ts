import type { ObjectStorageProvider } from '@stacksjs/ts-cloud'

/**
 * Bucket provisioning.
 *
 * An app that writes to object storage should not fail on its first upload
 * because nobody created the bucket by hand, and it should not require a
 * separate infrastructure step for something the app already knows the name of.
 * Vapor provisions the bucket as part of deploying; this is the same idea,
 * available both as an explicit call and as an on-demand check before a write.
 *
 * Creation is deliberately *not* implicit on every write. `ensureBucket` is
 * cheap but not free, and silently creating buckets from a typo'd config name
 * is how an account ends up with a dozen near-identical buckets and data
 * spread across them. Apps opt in via `filesystems.autoCreateBuckets`.
 */

export interface ProvisionOptions {
  /** Provider to talk to. Defaults to the resolved object-storage provider. */
  provider?: ObjectStorageProvider
  /** Region / location slug. Provider default when omitted. */
  region?: string
  /** Endpoint host override, no scheme. */
  endpoint?: string
  /** Explicit credentials; otherwise resolved from the provider's env vars. */
  credentials?: { accessKeyId: string, secretAccessKey: string }
  /** Canned ACL for a newly created bucket. Defaults to private. */
  acl?: string
}

export interface ProvisionResult {
  bucket: string
  /** `created` when this call made it, `exists` when it was already there. */
  status: 'created' | 'exists'
  provider: ObjectStorageProvider
  region: string
  endpoint?: string
  publicUrl: string
}

/**
 * Make sure `bucket` exists, creating it if it does not.
 *
 * Idempotent: an existing bucket is reported rather than treated as an error,
 * so this is safe to call on every deploy and on every boot.
 */
export async function ensureBucket(bucket: string, options: ProvisionOptions = {}): Promise<ProvisionResult> {
  if (!bucket)
    throw new Error('ensureBucket requires a bucket name.')

  const { createObjectStorageClient, resolveObjectStorage } = await import('@stacksjs/ts-cloud')

  const resolved = resolveObjectStorage(options)
  const client = createObjectStorageClient(options)

  const base = {
    bucket,
    provider: resolved.provider,
    region: resolved.region,
    endpoint: resolved.endpoint,
    publicUrl: resolved.publicBaseUrl(bucket),
  }

  if (await client.bucketExists(bucket))
    return { ...base, status: 'exists' }

  // A bucket created between the check and the create is a success, not a
  // collision: two app instances booting at once should not make one of them
  // crash. Providers differ on which of BucketAlreadyExists /
  // BucketAlreadyOwnedByYou they return, so both are treated as "it is there".
  try {
    await client.createBucket(bucket, { acl: options.acl ?? 'private' })
    return { ...base, status: 'created' }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (/BucketAlreadyOwnedByYou|BucketAlreadyExists|already exists/i.test(message))
      return { ...base, status: 'exists' }

    throw new Error(`Could not create bucket "${bucket}" on ${resolved.provider}: ${message}`)
  }
}

/**
 * Ensure every bucket the app's filesystem config names.
 *
 * Reads `filesystems.s3.bucket` plus any bucket named by a configured disk, so
 * a deploy provisions what the app is actually configured to use rather than a
 * list maintained separately.
 */
export async function ensureConfiguredBuckets(options: ProvisionOptions = {}): Promise<ProvisionResult[]> {
  const { filesystems } = await import('@stacksjs/config')

  const names = new Set<string>()

  if (filesystems?.s3?.bucket)
    names.add(filesystems.s3.bucket)

  for (const disk of Object.values((filesystems)?.disks ?? {})) {
    const candidate = (disk as { driver?: string, bucket?: string })
    if (candidate?.driver === 's3' && candidate.bucket)
      names.add(candidate.bucket)
  }

  if (names.size === 0)
    return []

  const results: ProvisionResult[] = []
  for (const name of names)
    results.push(await ensureBucket(name, options))

  return results
}
