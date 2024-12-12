import process from 'node:process'
import { S3 } from '@aws-sdk/client-s3'
import { SES } from '@aws-sdk/client-ses'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

const ses = new SES({ apiVersion: '2010-12-01' })
const s3 = new S3({ apiVersion: '2006-03-01' })

// oddly, this somehow does not play well within a CDK construct
// so we need to use the AWS SDK directly to create the rule
// unsure whether it’s an AWS or implementation issue

// need to query S3 to get the bucket name, based on whether the name contains -email-
// which is indicative of the email bucket created by the CDK construct
let bucketName: string | undefined
const data = await s3.listBuckets({})

if (data.Buckets)
  bucketName = data.Buckets.find(bucket => bucket.Name?.includes('-email-'))?.Name

console.log('Bucket Name:', bucketName)

if (!bucketName) {
  console.log('Stacks Email Bucket not found')
  process.exit(ExitCode.FatalError)
}

const params: any = {
  Rule: {
    Actions: [
      {
        S3Action: {
          BucketName: bucketName,
          ObjectKeyPrefix: 'tmp/email_in',
        },
      },
    ],
    Enabled: true,
    Name: 'Inbound',
    ScanEnabled: true,
    TlsPolicy: 'Require',
  },
  RuleSetName: 'your-rule-set-name',
}

try {
  const data = await ses.createReceiptRule(params)
  log.info('Success', data)
}
catch (error) {
  console.error(error)
}
