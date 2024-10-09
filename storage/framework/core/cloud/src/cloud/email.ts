import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import {
  Duration,
  aws_iam as iam,
  aws_lambda as lambda,
  RemovalPolicy,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_s3_notifications as s3n,
  aws_ses as ses,
  Stack,
  Tags,
} from 'aws-cdk-lib'

export interface EmailStackProps extends NestedCloudProps {
  zone: route53.IHostedZone
}

export class EmailStack {
  emailBucket: s3.Bucket

  constructor(scope: Construct, props: EmailStackProps) {
    const bucketPrefix = `${props.slug}-${props.appEnv}`
    this.emailBucket = new s3.Bucket(scope, 'EmailBucket', {
      bucketName: `${bucketPrefix}-email-${props.timestamp}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // encryptionKey: this.encryptionKey,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: '24h',
          enabled: true,
          expiration: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(1),
          prefix: 'today/',
        },
        {
          id: 'Intelligent transition for Inbox',
          enabled: true,
          prefix: 'inbox/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(0),
            },
          ],
        },
        {
          id: 'Intelligent transition for Sent',
          enabled: true,
          prefix: 'sent/',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(0),
            },
          ],
        },
      ],
    })

    Tags.of(this.emailBucket).add('daily-backup', 'true')

    const sesPrincipal = new iam.ServicePrincipal('ses.amazonaws.com')
    const ruleSetName = `${props.slug}-${props.appEnv}-email-receipt-rule-set`
    const receiptRuleName = `${props.slug}-${props.appEnv}-email-receipt-rule`

    const ruleSet = new ses.CfnReceiptRuleSet(scope, 'SESReceiptRuleSet', {
      ruleSetName,
    })

    this.emailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowSESPuts',
        effect: iam.Effect.ALLOW,
        principals: [sesPrincipal],
        actions: ['s3:PutObject'],
        resources: [`${this.emailBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': Stack.of(scope).account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:ses:${Stack.of(scope).region}:${
              Stack.of(scope).account
            }:receipt-rule-set/${ruleSetName}:receipt-rule/${receiptRuleName}`,
          },
        },
      }),
    )

    const receiptRule = new ses.CfnReceiptRule(scope, 'SESReceiptRule', {
      ruleSetName: ruleSet.ref,
      rule: {
        name: receiptRuleName,
        enabled: true,
        actions: [
          {
            s3Action: {
              bucketName: this.emailBucket.bucketName,
              objectKeyPrefix: 'tmp/email_in/',
            },
          },
        ],
        recipients: config.email.mailboxes || [],
        scanEnabled: config.email.server?.scan || true,
        tlsPolicy: 'Require',
      },
    })

    // this line is important to make sure the bucket is created before the receipt rule
    // do not remove it, unless you want a hell of a time debugging randomness
    receiptRule.node.addDependency(this.emailBucket)

    const iamGroup = new iam.Group(scope, 'IAMGroup', {
      groupName: `${props.slug}-${props.appEnv}-email-management-s3-group`,
    })

    const listBucketsPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListAllMyBuckets'],
      resources: ['*'],
    })

    const policyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:ListBucket',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:GetObjectAcl',
        's3:GetObjectVersionAcl',
        's3:PutObjectAcl',
        's3:PutObjectVersionAcl',
      ],
      resources: [this.emailBucket.bucketArn, `${this.emailBucket.bucketArn}/*`],
    })

    const policy = new iam.Policy(scope, 'EmailAccessPolicy', {
      policyName: `${props.slug}-${props.appEnv}-email-management-s3-policy`,
      statements: [policyStatement, listBucketsPolicyStatement],
    })

    iamGroup.attachInlinePolicy(policy)

    // Create a SES domain identity
    const sesIdentity = new ses.CfnEmailIdentity(scope, 'DomainIdentity', {
      emailIdentity: props.domain,

      dkimSigningAttributes: {
        nextSigningKeyLength: 'RSA_2048_BIT',
      },

      dkimAttributes: {
        signingEnabled: true,
      },

      mailFromAttributes: {
        behaviorOnMxFailure: 'USE_DEFAULT_VALUE',
        mailFromDomain: `mail.${props.domain}`,
      },

      feedbackAttributes: {
        emailForwardingEnabled: true,
      },
    })

    // Create a Route53 records for the SES domain identity
    // https://github.com/aws/aws-cdk/issues/21306
    new route53.CfnRecordSet(scope, 'DkimRecord1', {
      hostedZoneName: `${props.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName1,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue1],
      ttl: '1800',
    })

    new route53.CfnRecordSet(scope, 'DkimRecord2', {
      hostedZoneName: `${props.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName2,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue2],
      ttl: '1800',
    })

    new route53.CfnRecordSet(scope, 'DkimRecord3', {
      hostedZoneName: `${props.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName3,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue3],
      ttl: '1800',
    })

    new route53.MxRecord(scope, 'MxRecord', {
      zone: props.zone,
      recordName: 'mail',
      values: [
        {
          priority: 10,
          hostName: 'feedback-smtp.us-east-1.amazonses.com',
        },
      ],
    })

    new route53.TxtRecord(scope, 'TxtSpfRecord', {
      zone: props.zone,
      recordName: 'mail',
      values: ['v=spf1 include:amazonses.com ~all'],
    })

    new route53.TxtRecord(scope, 'TxtDmarcRecord', {
      zone: props.zone,
      recordName: '_dmarc',
      values: [`v=DMARC1;p=quarantine;pct=25;rua=mailto:dmarcreports@${props.domain}`],
    })

    const lambdaEmailOutboundRole = new iam.Role(scope, 'LambdaEmailOutboundRole', {
      roleName: `${props.slug}-${props.appEnv}-email-outbound`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    })

    const lambdaEmailOutbound = new lambda.Function(scope, 'LambdaEmailOutbound', {
      functionName: `${props.slug}-${props.appEnv}-email-outbound`,
      description: 'Take the JSON and convert it in to an raw email.',
      code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.emailBucket.bucketName,
      },
      role: lambdaEmailOutboundRole,
    })

    lambdaEmailOutboundRole.addToPolicy(policyStatement)

    const sesPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendRawEmail'],
      resources: ['*'],
    })

    lambdaEmailOutboundRole.addToPolicy(sesPolicyStatement)

    const lambdaEmailInboundRole = new iam.Role(scope, 'LambdaEmailInboundRole', {
      roleName: `${props.slug}-${props.appEnv}-email-inbound`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    })

    const lambdaEmailInbound = new lambda.Function(scope, 'LambdaEmailInbound', {
      functionName: `${props.slug}-${props.appEnv}-email-inbound`,
      description: 'This Lambda organizes all the incoming emails based on the From and To field.',
      code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      role: lambdaEmailInboundRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.emailBucket.bucketName,
      },
    })

    new lambda.CfnPermission(scope, 'S3InboundPermission', {
      action: 'lambda:InvokeFunction',
      functionName: lambdaEmailInbound.functionName,
      principal: 's3.amazonaws.com',
    })

    const inboundS3PolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [this.emailBucket.bucketArn, `${this.emailBucket.bucketArn}/*`],
    })

    lambdaEmailInboundRole.addToPolicy(inboundS3PolicyStatement)

    const sesInboundPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:ListIdentities'],
      resources: ['*'],
    })

    lambdaEmailInboundRole.addToPolicy(sesInboundPolicyStatement)

    const lambdaEmailConverterRole = new iam.Role(scope, 'LambdaEmailConverterRole', {
      roleName: `${props.slug}-${props.appEnv}-email-converter`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    })

    const lambdaEmailConverter = new lambda.Function(scope, 'LambdaEmailConverter', {
      functionName: `${props.slug}-${props.appEnv}-email-converter`,
      description: 'This Lambda converts raw emails files in to HTML and text.',
      code: lambda.Code.fromInline(
        'exports.handler = async (event) => {console.log("hello world email converter");return true;};',
      ), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      role: lambdaEmailConverterRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.emailBucket.bucketName,
      },
    })

    const converterS3PolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [this.emailBucket.bucketArn, `${this.emailBucket.bucketArn}/*`],
    })

    new lambda.CfnPermission(scope, 'S3ConverterPermission', {
      action: 'lambda:InvokeFunction',
      functionName: lambdaEmailConverter.functionName,
      principal: 's3.amazonaws.com',
    })

    lambdaEmailConverterRole.addToPolicy(converterS3PolicyStatement)

    this.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(lambdaEmailInbound),
      { prefix: 'tmp/email_in/' },
    )
    this.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(lambdaEmailOutbound),
      { prefix: 'tmp/email_out/json/' },
    )
    this.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_COPY,
      new s3n.LambdaDestination(lambdaEmailConverter),
      { prefix: 'sent/' },
    )
    this.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_COPY,
      new s3n.LambdaDestination(lambdaEmailConverter),
      { prefix: 'inbox/' },
    )
    this.emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_COPY,
      new s3n.LambdaDestination(lambdaEmailConverter),
      { prefix: 'today/' },
    )
  }
}
