/**
 * S3 presigned-POST policy signing (stacksjs/stacks#1888 Phase B, S-12 follow-up).
 *
 * Background: the S3 adapter's `presignedUploadUrl()` returns a PUT-form
 * presigned URL. PUT-form URLs CAN'T carry a `Content-Length-Range`
 * condition — only S3's presigned-POST form does. So the `maxBytes`
 * field on `PresignedUploadUrlOptions` is advisory only; a hostile
 * caller can PUT a 10 GB file at a URL signed for 1 MB.
 *
 * This module ships the missing piece: a SigV4-signed POST policy
 * that S3 enforces server-side. The browser submits a multipart form
 * (not a PUT body) containing the policy + signature + file; S3
 * rejects anything that violates the embedded conditions before a
 * byte hits storage.
 *
 * Why local rather than ts-cloud: `@stacksjs/ts-cloud`'s S3Client
 * doesn't expose a `createPresignedPost`-style method yet, and adding
 * it upstream would block this fix on a separate package release.
 * The signing is self-contained (~80 lines of HMAC chaining) and
 * carries zero runtime cost when callers don't use it.
 *
 * Spec: AWS S3 docs — \"Authenticating Requests in Browser-Based
 * Uploads Using POST (AWS Signature Version 4)\"
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-authentication-HTTPPOST.html
 */

import { createHmac } from 'node:crypto'
import { Buffer } from 'node:buffer'

/**
 * Inputs to {@link signS3PresignedPost}. Mirrors the
 * `presignedUploadPolicy()` adapter call once it's wired up.
 */
export interface S3PresignedPostInput {
  /** S3 bucket name. */
  bucket: string
  /** AWS region (e.g. `'us-east-1'`). */
  region: string
  /** Caller-supplied or env-sourced credentials. */
  credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  /**
   * Exact S3 key OR a prefix to enforce via `starts-with`. Use a
   * specific key when the server has already decided the final name;
   * use a prefix when the client picks the suffix (e.g. uploading
   * many files into a single per-user folder).
   */
  key: string | { startsWith: string }
  /**
   * Required Content-Type the upload must submit. S3 rejects the
   * upload if the form's `Content-Type` field doesn't match.
   *
   * Pass an exact string for strict matching, or a `{ startsWith }`
   * shape for prefix-matching (e.g. `{ startsWith: 'image/' }`).
   */
  contentType: string | { startsWith: string }
  /**
   * Minimum + maximum upload size in bytes. S3 ENFORCES this server-
   * side — uploads outside the range are rejected. This is the whole
   * reason to use POST-form over PUT-form.
   */
  contentLengthRange?: { min: number, max: number }
  /** ACL on the resulting object. Defaults to `'private'`. */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'bucket-owner-read' | 'bucket-owner-full-control'
  /** Seconds until the policy expires. Clamped to [60, 7*24*60*60]. */
  expiresIn: number
  /**
   * Optional caller-controlled extra fields (e.g. `success_action_redirect`,
   * `x-amz-meta-*`). Each entry becomes a `{ [field]: value }` condition
   * AND is included verbatim in the returned `fields` map.
   */
  fields?: Record<string, string>
}

/**
 * What the browser submits. The form is `multipart/form-data` POSTed
 * to `url`; every key in `fields` becomes a form field with the same
 * name. The actual file MUST be the LAST field, named `'file'`.
 */
export interface S3PresignedPostResult {
  /** Form action URL (the bucket endpoint). */
  url: string
  /** Every form field the browser must include before the `file` field. */
  fields: Record<string, string>
  /**
   * The S3 key the upload will land at — either the exact `key`
   * provided, or `${startsWith}<client-chosen-suffix>` when a
   * prefix was used. Caller stores this on the domain record.
   */
  key: string
}

const ALGORITHM = 'AWS4-HMAC-SHA256'
const MIN_EXPIRY = 60
const MAX_EXPIRY = 7 * 24 * 60 * 60

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function deriveSigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  // SigV4 derived-key chain — same as `getSignedUrl` uses for GET/PUT.
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  return kSigning
}

function isoDate(now: Date): { amzDate: string, dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  // Pad to 8 chars (YYYYMMDD).
  const dateStamp = amzDate.slice(0, 8)
  return { amzDate, dateStamp }
}

/**
 * Build + sign an S3 presigned-POST policy.
 *
 * @example
 * ```ts
 * const post = signS3PresignedPost({
 *   bucket: 'app-uploads',
 *   region: 'us-east-1',
 *   credentials: { accessKeyId, secretAccessKey },
 *   key: { startsWith: 'avatars/' },
 *   contentType: { startsWith: 'image/' },
 *   contentLengthRange: { min: 0, max: 5 * 1024 * 1024 },
 *   expiresIn: 3600,
 * })
 *
 * // Browser side:
 * //   const fd = new FormData()
 * //   Object.entries(post.fields).forEach(([k, v]) => fd.append(k, v))
 * //   fd.append('file', file)  // MUST be last
 * //   await fetch(post.url, { method: 'POST', body: fd })
 * ```
 */
export function signS3PresignedPost(input: S3PresignedPostInput): S3PresignedPostResult {
  const expiresIn = Math.floor(input.expiresIn)
  if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRY || expiresIn > MAX_EXPIRY) {
    throw new RangeError(`[storage/s3-post] expiresIn must be between ${MIN_EXPIRY}s and ${MAX_EXPIRY}s (got ${expiresIn}s)`)
  }
  if (!input.bucket) throw new Error('[storage/s3-post] bucket is required')
  if (!input.credentials?.accessKeyId || !input.credentials?.secretAccessKey) {
    throw new Error('[storage/s3-post] credentials.accessKeyId and credentials.secretAccessKey are required')
  }

  const now = new Date()
  const { amzDate, dateStamp } = isoDate(now)
  const credentialScope = `${dateStamp}/${input.region}/s3/aws4_request`
  const credentialField = `${input.credentials.accessKeyId}/${credentialScope}`

  const expirationDate = new Date(now.getTime() + expiresIn * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')

  // Build the conditions list. Order doesn't matter to S3 but we
  // emit a stable ordering so signatures are deterministic for tests.
  const conditions: Array<Record<string, string> | [string, string | number, string | number]> = []
  conditions.push({ bucket: input.bucket })

  if (typeof input.key === 'string') {
    conditions.push({ key: input.key })
  }
  else {
    conditions.push(['starts-with', '$key', input.key.startsWith])
  }

  const acl = input.acl ?? 'private'
  conditions.push({ acl })

  if (typeof input.contentType === 'string') {
    conditions.push({ 'Content-Type': input.contentType })
  }
  else {
    conditions.push(['starts-with', '$Content-Type', input.contentType.startsWith])
  }

  if (input.contentLengthRange) {
    if (!Number.isFinite(input.contentLengthRange.min) || input.contentLengthRange.min < 0
      || !Number.isFinite(input.contentLengthRange.max) || input.contentLengthRange.max < input.contentLengthRange.min) {
      throw new RangeError('[storage/s3-post] contentLengthRange must satisfy 0 <= min <= max')
    }
    conditions.push(['content-length-range', input.contentLengthRange.min, input.contentLengthRange.max])
  }

  // Custom caller fields. Each one becomes a strict-equality condition.
  if (input.fields) {
    for (const [k, v] of Object.entries(input.fields)) {
      conditions.push({ [k]: v })
    }
  }

  conditions.push({ 'x-amz-credential': credentialField })
  conditions.push({ 'x-amz-algorithm': ALGORITHM })
  conditions.push({ 'x-amz-date': amzDate })
  if (input.credentials.sessionToken) {
    conditions.push({ 'x-amz-security-token': input.credentials.sessionToken })
  }

  const policy = {
    expiration: expirationDate,
    conditions,
  }
  const policyBase64 = Buffer.from(JSON.stringify(policy), 'utf8').toString('base64')

  const signingKey = deriveSigningKey(input.credentials.secretAccessKey, dateStamp, input.region)
  const signature = createHmac('sha256', signingKey).update(policyBase64, 'utf8').digest('hex')

  const fields: Record<string, string> = {
    'key': typeof input.key === 'string' ? input.key : `${input.key.startsWith}\${filename}`,
    'acl': acl,
    'Content-Type': typeof input.contentType === 'string' ? input.contentType : input.contentType.startsWith,
    'x-amz-credential': credentialField,
    'x-amz-algorithm': ALGORITHM,
    'x-amz-date': amzDate,
    'policy': policyBase64,
    'x-amz-signature': signature,
    ...(input.credentials.sessionToken ? { 'x-amz-security-token': input.credentials.sessionToken } : {}),
    ...(input.fields ?? {}),
  }

  return {
    url: `https://${input.bucket}.s3.${input.region}.amazonaws.com/`,
    fields,
    key: typeof input.key === 'string' ? input.key : input.key.startsWith,
  }
}
