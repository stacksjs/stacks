import process from 'node:process'
import { S3Client, SESClient } from '@stacksjs/ts-cloud'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

const ses = new SESClient()
const s3 = new S3Client()

// need to query S3 to get the bucket name, based on whether the name contains -email-
// which is indicative of the email bucket created by the infrastructure
let bucketName: string | undefined
const data = await s3.listBuckets()

if (data.Buckets)
  bucketName = data.Buckets.find(bucket => bucket.Name?.includes('-email-'))?.Name

console.log('Bucket Name:', bucketName)

if (!bucketName) {
  console.log('Stacks Email Bucket not found')
  process.exit(ExitCode.FatalError)
}

try {
  await ses.createReceiptRule({
    RuleSetName: 'your-rule-set-name',
    Rule: {
      Name: 'Inbound',
      Enabled: true,
      ScanEnabled: true,
      TlsPolicy: 'Require',
      Actions: [
        {
          S3Action: {
            BucketName: bucketName,
            ObjectKeyPrefix: 'tmp/email_in',
          },
        },
      ],
    },
  })
  log.info('Success: Receipt rule created')
}
catch (error) {
  console.error(error)
}
