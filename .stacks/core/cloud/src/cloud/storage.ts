import { NestedStack, RemovalPolicy, Tags, aws_backup as backup, aws_iam as iam, aws_kms as kms, aws_s3 as s3 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class StorageStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Storage', props)

    const bucketPrefix = `${props.appName}-${props.appEnv}`
    // const docsSource = '../../../storage/docs'
    // const websiteSource = config.app.docMode ? docsSource : '../../../storage/public'

    const publicBucket = new s3.Bucket(this, 'PublicBucket', {
      bucketName: `${bucketPrefix}-${props.partialAppKey}`,
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    Tags.of(publicBucket).add('daily-backup', 'true')

    const privateBucket = new s3.Bucket(this, 'PrivateBucket', {
      bucketName: `${bucketPrefix}-private-${props.partialAppKey}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
    })
    Tags.of(privateBucket).add('daily-backup', 'true')

    const logBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `${bucketPrefix}-logs-${props.partialAppKey}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: true,
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })
    Tags.of(logBucket).add('daily-backup', 'true')

    const backupRole = this.createBackupRole()

    // Daily 35 day retention
    const keyFromAlias = kms.Key.fromLookup(this, 'Key', {
      aliasName: 'alias/stacks-encryption-key',
    })

    const vault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: `${props.appName}-${props.appEnv}-daily-backup-vault`,
      encryptionKey: keyFromAlias,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const plan = backup.BackupPlan.daily35DayRetention(this, 'BackupPlan', vault)

    plan.addSelection('Selection', {
      role: backupRole,
      resources: [backup.BackupResource.fromTag('daily-backup', 'true')],
    })

    // for each redirect, create a bucket & redirect it to the APP_URL
    // config.dns.redirects?.forEach((redirect) => {
    //   // TODO: use string-ts function here instead
    //   const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
    //   const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: redirect })
    //   const redirectBucket = new s3.Bucket(this, `RedirectBucket${slug}`, {
    //     bucketName: `${redirect}-redirect`,
    //     websiteRedirect: {
    //       hostName: this.domain,
    //       protocol: s3.RedirectProtocol.HTTPS,
    //     },
    //     removalPolicy: RemovalPolicy.DESTROY,
    //     autoDeleteObjects: true,
    //   })
    //   new route53.CnameRecord(this, `RedirectRecord${slug}`, {
    //     zone: hostedZone,
    //     recordName: 'redirect',
    //     domainName: redirectBucket.bucketWebsiteDomainName,
    //   })
    // })
  }

  createBackupRole() {
    const backupRole = new iam.Role(this, 'BackupRole', {
      assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
    })
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetInventoryConfiguration',
          's3:PutInventoryConfiguration',
          's3:ListBucketVersions',
          's3:ListBucket',
          's3:GetBucketVersioning',
          's3:GetBucketNotification',
          's3:PutBucketNotification',
          's3:GetBucketLocation',
          's3:GetBucketTagging',
        ],
        resources: ['arn:aws:s3:::*'],
        sid: 'S3BucketBackupPermissions',
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObjectAcl',
          's3:GetObject',
          's3:GetObjectVersionTagging',
          's3:GetObjectVersionAcl',
          's3:GetObjectTagging',
          's3:GetObjectVersion',
        ],
        resources: ['arn:aws:s3:::*/*'],
        sid: 'S3ObjectBackupPermissions',
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListAllMyBuckets'],
        resources: ['*'],
        sid: 'S3GlobalPermissions',
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListAllMyBuckets'],
        resources: ['*'],
        sid: 'S3GlobalPermissions',
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt', 'kms:DescribeKey'],
        resources: ['*'],
        sid: 'KMSBackupPermissions',
        conditions: {
          StringLike: {
            'kms:ViaService': 's3.*.amazonaws.com',
          },
        },
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'events:DescribeRule',
          'events:EnableRule',
          'events:PutRule',
          'events:DeleteRule',
          'events:PutTargets',
          'events:RemoveTargets',
          'events:ListTargetsByRule',
          'events:DisableRule',
        ],
        resources: ['arn:aws:events:*:*:rule/AwsBackupManagedRule*'],
        sid: 'EventsPermissions',
      }),
    )
    backupRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:GetMetricData', 'events:ListRules'],
        resources: ['*'],
        sid: 'EventsMetricsGlobalPermissions',
      }),
    )
    return backupRole
  }
}
