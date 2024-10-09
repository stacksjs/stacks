import type { aws_cloudfront as cloudfront, aws_kms as kms } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
import { aws_backup as backup, aws_iam as iam, RemovalPolicy, aws_s3 as s3, Tags } from 'aws-cdk-lib'

export interface StorageStackProps extends NestedCloudProps {
  kmsKey: kms.Key
  originAccessIdentity: cloudfront.OriginAccessIdentity
}

export class StorageStack {
  publicBucket: s3.Bucket
  privateBucket: s3.Bucket
  docsBucket?: s3.Bucket
  logBucket: s3.Bucket
  bucketPrefix: string
  vault: backup.BackupVault
  backupPlan: backup.BackupPlan
  backupRole: iam.Role

  constructor(scope: Construct, props: StorageStackProps) {
    this.bucketPrefix = `${props.slug}-${props.appEnv}`

    this.publicBucket = new s3.Bucket(scope, 'PublicBucket', {
      bucketName: `${this.bucketPrefix}-public-${props.timestamp}`,
      versioned: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    })

    Tags.of(this.publicBucket).add('daily-backup', 'true')

    if (this.shouldDeployDocs()) {
      this.docsBucket = new s3.Bucket(scope, 'DocsBucket', {
        bucketName: `${this.bucketPrefix}-docs-${props.timestamp}`,
        versioned: true,
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
        encryption: s3.BucketEncryption.S3_MANAGED,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'index.html',
        publicReadAccess: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      })

      Tags.of(this.docsBucket).add('weekly-backup', 'true')
    }

    this.privateBucket = new s3.Bucket(scope, 'PrivateBucket', {
      bucketName: `${this.bucketPrefix}-private-${props.timestamp}`,
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

    Tags.of(this.privateBucket).add('daily-backup', 'true')

    this.logBucket = new s3.Bucket(scope, 'LogsBucket', {
      bucketName: `${this.bucketPrefix}-logs-${props.timestamp}`,
      removalPolicy: RemovalPolicy.RETAIN, // somehow, if we try to auto-delete logs, it fails bc the bucket is not empty (even though objects should be deleted) -> that's why we let buddy cloud:cleanup handle this which is auto triggered when buddy undeploy is ran
      // autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: true,
        blockPublicPolicy: true,
        restrictPublicBuckets: true,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })

    Tags.of(this.logBucket).add('daily-backup', 'true')

    this.backupRole = this.createBackupRole(scope)

    // Daily 35 day retention
    this.vault = new backup.BackupVault(scope, 'BackupVault', {
      backupVaultName: `${props.slug}-${props.appEnv}-daily-backup-vault`,
      encryptionKey: props.kmsKey,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.backupPlan = backup.BackupPlan.daily35DayRetention(scope, 'BackupPlan', this.vault)

    this.backupPlan.addSelection('Selection', {
      role: this.backupRole,
      resources: [backup.BackupResource.fromTag('daily-backup', 'true')],
    })
  }

  createBackupRole(scope: Construct): iam.Role {
    const backupRole = new iam.Role(scope, 'BackupRole', {
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

  shouldDeployDocs(): boolean {
    return (hasFiles(p.projectPath('docs')) || config.app.docMode) ?? false
  }
}
