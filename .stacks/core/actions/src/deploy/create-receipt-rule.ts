import type { ListBucketsCommandOutput } from '@aws-sdk/client-s3'
import { S3 } from '@aws-sdk/client-s3'
import { SES } from '@aws-sdk/client-ses'
import { ExitCode } from '@stacksjs/types'
import type { AWSError } from 'aws-sdk'
import process from 'node:process'

const ses = new SES({ apiVersion: '2010-12-01' })
const s3 = new S3({ apiVersion: '2006-03-01' })

// oddly, this somehow does not play well within a CDK construct
// so we need to use the AWS SDK directly to create the rule
// unsure whether it's an AWS or implementation issue

// need to query S3 to get the bucket name, based on whether the name contains -email-
// which is indicative of the email bucket created by the CDK construct
let bucketName: string | undefined
s3.listBuckets((err: AWSError, data: ListBucketsCommandOutput) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.log('Error', err)
  }
  else {
    console.log('Data', data)
    if (data.Buckets) {
      bucketName = data.Buckets.find(bucket => bucket.Name && bucket.Name.includes('-email-'))?.Name
      // eslint-disable-next-line no-console
      console.log('Bucket Name:', bucketName)

      if (!bucketName) {
        // eslint-disable-next-line no-console
        console.log('Stacks Email Bucket not found')
        process.exit(ExitCode.FatalError)
      }

      const params = {
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

      ses.createReceiptRule(params, (err: AWSError, data: any) => {
        if (err)
          // eslint-disable-next-line no-console
          console.log(err, err.stack)
        else
          // eslint-disable-next-line no-console
          console.log(data)
      })
    }
  }
})
