import { describe, expect, it } from 'bun:test'
import { S3Client as TsCloudS3Client } from '@stacksjs/ts-cloud'
import { S3Client } from '../src/index'

/**
 * `@stacksjs/cloud` used to ship its own copy of the S3 client (`imap/s3.ts`).
 * The copy drifted from ts-cloud: its bucket configuration getters read
 * `result.<RootElement>` from a parser that strips the root, so each returned
 * undefined for a configured bucket and `getBucketLocation` always reported
 * us-east-1. The export now points at ts-cloud, which fixed those getters in
 * 0.16.19. These tests fail if a copy comes back, or if the installed ts-cloud
 * predates the fix.
 */
describe('@stacksjs/cloud S3Client', () => {
  it('is ts-cloud\'s client, not a vendored copy', () => {
    expect(S3Client).toBe(TsCloudS3Client)
  })

  const XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
  const NS = 'xmlns="http://s3.amazonaws.com/doc/2006-03-01/"'

  // Answer the next request with a real S3 body run through the client's own
  // parser, so the shape under test is the one the parser actually emits.
  function respondWith(client: S3Client, xml: string): void {
    const aws: any = (client as any).client
    aws.request = async () => aws.parseXmlResponse(XML + xml)
  }

  it('reads bucket versioning through the stripped XML root', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<VersioningConfiguration ${NS}><Status>Enabled</Status></VersioningConfiguration>`)
    expect(await client.getBucketVersioning('b')).toEqual({ Status: 'Enabled' })
  })

  it('reads the bucket region rather than always reporting us-east-1', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<LocationConstraint ${NS}>us-west-2</LocationConstraint>`)
    expect(await client.getBucketLocation('b')).toBe('us-west-2')
  })

  it('reads the public access block through the stripped XML root', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<PublicAccessBlockConfiguration ${NS}><BlockPublicAcls>true</BlockPublicAcls><IgnorePublicAcls>true</IgnorePublicAcls><BlockPublicPolicy>true</BlockPublicPolicy><RestrictPublicBuckets>true</RestrictPublicBuckets></PublicAccessBlockConfiguration>`)
    expect(await client.getPublicAccessBlock('b')).toEqual({
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
    })
  })

  it('reads the encryption rule without the root\'s xmlns attribute', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<ServerSideEncryptionConfiguration ${NS}><Rule><ApplyServerSideEncryptionByDefault><SSEAlgorithm>aws:kms</SSEAlgorithm><KMSMasterKeyID>arn:aws:kms:us-east-1:123456789012:key/abc</KMSMasterKeyID></ApplyServerSideEncryptionByDefault><BucketKeyEnabled>true</BucketKeyEnabled></Rule></ServerSideEncryptionConfiguration>`)
    expect(await client.getBucketEncryption('b')).toEqual({
      Rule: {
        ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms', KMSMasterKeyID: 'arn:aws:kms:us-east-1:123456789012:key/abc' },
        BucketKeyEnabled: true,
      },
    })
  })
})
