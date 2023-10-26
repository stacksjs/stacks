import { S3 } from '@aws-sdk/client-s3'
import { CreateReceiptRuleCommand, SES, TlsPolicy } from '@aws-sdk/client-ses'

// let kmsKeyArn: string | undefined

interface ReceiptRuleCommandParams {
  bucketName: string
  emailAddresses: string[]
  name: string
  ruleSet: string
}

function createS3ReceiptRuleCommand({
  bucketName,
  emailAddresses,
  name,
  ruleSet,
}: ReceiptRuleCommandParams) {
  return new CreateReceiptRuleCommand({
    Rule: {
      Actions: [
        {
          S3Action: {
            BucketName: bucketName,
            ObjectKeyPrefix: 'tmp/email_in/',
            // KmsKeyArn: kmsKeyArn,
          },
        },
      ],
      Recipients: emailAddresses,
      Enabled: true,
      Name: name,
      ScanEnabled: true,
      TlsPolicy: TlsPolicy.Require,
    },
    RuleSetName: ruleSet, // Required
  })
}

async function run() {
  const ses = new SES()
  const s3 = new S3()

  const RULE_SET_NAME = 'stacks-production-email-receipt-rule-set'
  const RULE_NAME = 'stacks-production-email-receipt-rule'
  let bucketName: string | undefined

  const { Buckets } = await s3.listBuckets({})

  if (!Buckets)
    throw new Error('No buckets defined')

  console.log('test here')
  for (const bucket of Buckets) {
    if (bucket.Name?.includes('-email-'))
      bucketName = bucket.Name
    // const encryption = await s3.({ Bucket: bucketName })
    // if (encryption.ServerSideEncryptiongetBucketEncryptionConfiguration?.Rules)
    //   kmsKeyArn = encryption.ServerSideEncryptionConfiguration.Rules[0]?.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID
  }

  console.log('bucketName', bucketName)

  const s3ReceiptRuleCommand = createS3ReceiptRuleCommand({
    bucketName: bucketName ?? 'global-search-me',
    emailAddresses: ['chris@stacksjs.org'],
    name: RULE_NAME,
    ruleSet: RULE_SET_NAME,
  })

  try {
    return await ses.send(s3ReceiptRuleCommand)
  }
  catch (err) {
    console.log('Failed to create S3 receipt rule.', err)
    throw err
  }
}

await run()

// snippet-end:[ses.JavaScript.rules.createReceiptRuleV3]
// export { RULE_SET_NAME, S3_BUCKET_NAME, run }
