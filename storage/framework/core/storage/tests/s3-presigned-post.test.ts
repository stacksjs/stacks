import { describe, expect, test } from 'bun:test'
import { Buffer } from 'node:buffer'
import { signS3PresignedPost } from '../src/s3-presigned-post'

// stacksjs/stacks#1888 Phase B (S-12 follow-up) — S3 POST policy
// signing. Spot-checks the shape the browser must POST.

const FIXED_CREDS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}

describe('signS3PresignedPost', () => {
  test('exact-key form returns url + fields + key', () => {
    const result = signS3PresignedPost({
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: 'uploads/foo.jpg',
      contentType: 'image/jpeg',
      contentLengthRange: { min: 0, max: 1024 * 1024 },
      expiresIn: 3600,
    })

    expect(result.url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/')
    expect(result.key).toBe('uploads/foo.jpg')
    expect(result.fields.key).toBe('uploads/foo.jpg')
    expect(result.fields.acl).toBe('private')
    expect(result.fields['Content-Type']).toBe('image/jpeg')
    expect(result.fields['x-amz-algorithm']).toBe('AWS4-HMAC-SHA256')
    expect(result.fields['x-amz-credential']).toContain('AKIAIOSFODNN7EXAMPLE')
    expect(result.fields['x-amz-credential']).toContain('/us-east-1/s3/aws4_request')
    expect(result.fields['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)
    expect(typeof result.fields.policy).toBe('string')
    expect(result.fields['x-amz-signature']).toMatch(/^[a-f0-9]{64}$/)
  })

  test('prefix-key form embeds ${filename} substitution', () => {
    const result = signS3PresignedPost({
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: { startsWith: 'avatars/' },
      contentType: { startsWith: 'image/' },
      expiresIn: 3600,
    })

    expect(result.fields.key).toBe('avatars/${filename}')
    expect(result.key).toBe('avatars/')
    expect(result.fields['Content-Type']).toBe('image/')
  })

  test('encoded policy has the bucket + key conditions', () => {
    const result = signS3PresignedPost({
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: 'uploads/foo.jpg',
      contentType: 'image/jpeg',
      contentLengthRange: { min: 100, max: 5_000_000 },
      expiresIn: 3600,
    })

    const decoded = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString('utf8')) as {
      expiration: string
      conditions: Array<Record<string, string> | [string, string | number, string | number]>
    }
    expect(decoded.expiration).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(decoded.conditions).toContainEqual({ bucket: 'my-bucket' })
    expect(decoded.conditions).toContainEqual({ key: 'uploads/foo.jpg' })
    expect(decoded.conditions).toContainEqual(['content-length-range', 100, 5_000_000])
  })

  test('sessionToken propagates into both the policy and fields', () => {
    const result = signS3PresignedPost({
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: { ...FIXED_CREDS, sessionToken: 'STS-TOKEN' },
      key: 'foo.bin',
      contentType: 'application/octet-stream',
      expiresIn: 3600,
    })
    expect(result.fields['x-amz-security-token']).toBe('STS-TOKEN')
    const decoded = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString('utf8'))
    expect(decoded.conditions).toContainEqual({ 'x-amz-security-token': 'STS-TOKEN' })
  })

  test('extra fields appear in both policy and form', () => {
    const result = signS3PresignedPost({
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: 'foo.txt',
      contentType: 'text/plain',
      expiresIn: 3600,
      fields: { 'x-amz-meta-userid': '42', 'success_action_redirect': 'https://example.com/done' },
    })
    expect(result.fields['x-amz-meta-userid']).toBe('42')
    expect(result.fields.success_action_redirect).toBe('https://example.com/done')
    const decoded = JSON.parse(Buffer.from(result.fields.policy, 'base64').toString('utf8'))
    expect(decoded.conditions).toContainEqual({ 'x-amz-meta-userid': '42' })
  })

  test('rejects expiresIn outside [60, 7 days]', () => {
    const base = {
      bucket: 'b',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: 'k',
      contentType: 'text/plain',
    } as const
    expect(() => signS3PresignedPost({ ...base, expiresIn: 0 })).toThrow(RangeError)
    expect(() => signS3PresignedPost({ ...base, expiresIn: 59 })).toThrow(RangeError)
    expect(() => signS3PresignedPost({ ...base, expiresIn: 8 * 24 * 60 * 60 })).toThrow(RangeError)
    expect(() => signS3PresignedPost({ ...base, expiresIn: 60 })).not.toThrow()
  })

  test('rejects malformed contentLengthRange', () => {
    expect(() =>
      signS3PresignedPost({
        bucket: 'b',
        region: 'us-east-1',
        credentials: FIXED_CREDS,
        key: 'k',
        contentType: 'text/plain',
        contentLengthRange: { min: -1, max: 100 },
        expiresIn: 3600,
      }),
    ).toThrow(RangeError)

    expect(() =>
      signS3PresignedPost({
        bucket: 'b',
        region: 'us-east-1',
        credentials: FIXED_CREDS,
        key: 'k',
        contentType: 'text/plain',
        contentLengthRange: { min: 100, max: 50 },
        expiresIn: 3600,
      }),
    ).toThrow(RangeError)
  })

  test('rejects missing credentials', () => {
    expect(() =>
      signS3PresignedPost({
        bucket: 'b',
        region: 'us-east-1',
        credentials: { accessKeyId: '', secretAccessKey: '' },
        key: 'k',
        contentType: 'text/plain',
        expiresIn: 3600,
      }),
    ).toThrow(/credentials/)
  })

  test('signature is deterministic for the same input + minute', () => {
    // Same input issued in the same second → identical signature.
    // Useful to confirm we're not pulling Math.random anywhere.
    const input = {
      bucket: 'my-bucket',
      region: 'us-east-1',
      credentials: FIXED_CREDS,
      key: 'k',
      contentType: 'text/plain',
      expiresIn: 3600,
    } as const
    const a = signS3PresignedPost(input)
    const b = signS3PresignedPost(input)
    // dates may differ across the second-boundary; allow either match
    // OR both fields match each other within the same date stamp
    if (a.fields['x-amz-date'] === b.fields['x-amz-date']) {
      expect(a.fields['x-amz-signature']).toBe(b.fields['x-amz-signature'])
    }
  })
})
