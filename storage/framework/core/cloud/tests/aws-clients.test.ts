import { describe, expect, it } from 'bun:test'
import * as tsCloud from '@stacksjs/ts-cloud'
import { AWSClient, S3Client, SecretsManagerClient, SmtpServer } from '../src/index'

/**
 * `@stacksjs/cloud` used to ship its own copies of ts-cloud's AWS, S3, SES and
 * Secrets Manager clients under `imap/`. The copies drifted: the S3 bucket
 * configuration getters and SES's quota and statistics read
 * `result.<RootElement>` from a parser that strips the root, so each returned
 * undefined, and `getBucketLocation` always reported us-east-1. The exports now
 * point at ts-cloud, which fixed those in 0.16.19 and 0.16.20 and took the
 * copies' ClientRequestToken fix in 0.16.21. These tests fail if a copy comes
 * back, or if the installed ts-cloud predates the fixes.
 */
describe('@stacksjs/cloud AWS clients are ts-cloud\'s', () => {
  it('exports ts-cloud\'s classes, not vendored copies', () => {
    expect(AWSClient).toBe(tsCloud.AWSClient)
    expect(S3Client).toBe(tsCloud.S3Client)
    expect(SecretsManagerClient).toBe(tsCloud.SecretsManagerClient)
  })

  it('relays SmtpServer mail through ts-cloud\'s SES client', () => {
    const server = new SmtpServer({ port: 0, domain: 'example.com', users: {} })
    expect((server as any).ses).toBeInstanceOf(tsCloud.SESClient)
  })
})

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n'

// Answer the next request with a real AWS body run through the client's own
// parser, so the shape under test is the one the parser actually emits.
function respondWith(client: object, xml: string): void {
  const aws: any = (client as any).client
  aws.request = async () => aws.parseXmlResponse(XML + xml)
}

describe('S3Client reads bucket configuration through the stripped XML root', () => {
  const NS = 'xmlns="http://s3.amazonaws.com/doc/2006-03-01/"'

  it('reads bucket versioning', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<VersioningConfiguration ${NS}><Status>Enabled</Status></VersioningConfiguration>`)
    expect(await client.getBucketVersioning('b')).toEqual({ Status: 'Enabled' })
  })

  it('reads the bucket region rather than always reporting us-east-1', async () => {
    const client = new S3Client('us-east-1')
    respondWith(client, `<LocationConstraint ${NS}>us-west-2</LocationConstraint>`)
    expect(await client.getBucketLocation('b')).toBe('us-west-2')
  })

  it('reads the public access block', async () => {
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

describe('SES client reads the send quota through the stripped XML root', () => {
  it('reports the quota, including a zero count', async () => {
    const client = new tsCloud.SESClient('us-east-1')
    respondWith(client, '<GetSendQuotaResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/"><GetSendQuotaResult><SentLast24Hours>0.0</SentLast24Hours><Max24HourSend>50000.0</Max24HourSend><MaxSendRate>14.0</MaxSendRate></GetSendQuotaResult><ResponseMetadata><RequestId>r</RequestId></ResponseMetadata></GetSendQuotaResponse>')
    expect(await client.getSendQuota()).toEqual({ Max24HourSend: 50000, MaxSendRate: 14, SentLast24Hours: 0 })
  })
})

describe('SecretsManagerClient sends a ClientRequestToken', () => {
  it('generates one on updateSecret, which buddy mail calls with a new value', async () => {
    const client = new SecretsManagerClient('us-east-1')
    const bodies: Array<Record<string, any>> = []
    ;(client as any).client.request = async (options: any) => {
      bodies.push(JSON.parse(options.body))
      return {}
    }
    await client.updateSecret({ SecretId: 's', KmsKeyId: 'arn:aws:kms:us-east-1:1:key/k', SecretString: '{}' })
    expect(bodies[0]?.ClientRequestToken).toMatch(/^[0-9a-f-]{36}$/)
  })
})
