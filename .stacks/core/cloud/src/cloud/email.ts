// async manageEmailServer() {
//   this.storage.emailBucket = await this.getOrCreateBucket('email')

//   const sesPrincipal = new iam.ServicePrincipal('ses.amazonaws.com')
//   const ruleSetName = `${this.appName}-${appEnv}-email-receipt-rule-set`
//   const receiptRuleName = `${this.appName}-${appEnv}-email-receipt-rule`

//   const ruleSet = new ses.CfnReceiptRuleSet(this, 'SESReceiptRuleSet', {
//     ruleSetName,
//   })

//   this.storage.emailBucket.addToResourcePolicy(
//     new iam.PolicyStatement({
//       sid: 'AllowSESPuts',
//       effect: iam.Effect.ALLOW,
//       principals: [sesPrincipal],
//       actions: [
//         's3:PutObject',
//       ],
//       resources: [
//         `${this.storage.emailBucket.bucketArn}/*`,
//       ],
//       conditions: {
//         StringEquals: {
//           'aws:SourceAccount': Stack.of(this).account,
//         },
//         ArnLike: {
//           'aws:SourceArn': `arn:aws:ses:${this.region}:${Stack.of(this).account}:receipt-rule-set/${ruleSetName}:receipt-rule/${receiptRuleName}`,
//         },
//       },
//     }),
//   )

//   new ses.CfnReceiptRule(this, 'SESReceiptRule', {
//     ruleSetName: ruleSet.ref,
//     rule: {
//       name: receiptRuleName,
//       enabled: true,
//       actions: [
//         {
//           s3Action: {
//             bucketName: this.storage.emailBucket.bucketName,
//             objectKeyPrefix: 'tmp/email_in/',
//           },
//         },
//       ],
//       recipients: config.email.server?.mailboxes || [],
//       scanEnabled: config.email.server?.scan || true,
//       tlsPolicy: 'Require',
//     },
//   })

//   const iamGroup = new iam.Group(this, 'IAMGroup', {
//     groupName: `${this.appName}-${appEnv}-email-management-s3-group`,
//   })

//   const listBucketsPolicyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: ['s3:ListAllMyBuckets'],
//     resources: ['*'],
//   })

//   const policyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: [
//       's3:ListBucket',
//       's3:GetObject',
//       's3:PutObject',
//       's3:DeleteObject',
//       's3:GetObjectAcl',
//       's3:GetObjectVersionAcl',
//       's3:PutObjectAcl',
//       's3:PutObjectVersionAcl',
//     ],
//     resources: [
//       this.storage.emailBucket.bucketArn,
//       `${this.storage.emailBucket.bucketArn}/*`,
//     ],
//   })

//   const policy = new iam.Policy(this, 'EmailAccessPolicy', {
//     policyName: `${this.appName}-${appEnv}-email-management-s3-policy`,
//     statements: [policyStatement, listBucketsPolicyStatement],
//   })

//   iamGroup.attachInlinePolicy(policy)

//   // Create a SES domain identity
//   const sesIdentity = new ses.CfnEmailIdentity(this, 'DomainIdentity', {
//     emailIdentity: this.domain,

//     dkimSigningAttributes: {
//       nextSigningKeyLength: 'RSA_2048_BIT',
//     },

//     dkimAttributes: {
//       signingEnabled: true,
//     },

//     mailFromAttributes: {
//       behaviorOnMxFailure: 'USE_DEFAULT_VALUE',
//       mailFromDomain: `mail.${this.domain}`,
//     },

//     feedbackAttributes: {
//       emailForwardingEnabled: true,
//     },
//   })

//   // Create a Route53 records for the SES domain identity
//   // https://github.com/aws/aws-cdk/issues/21306
//   new route53.CfnRecordSet(this, 'DkimRecord1', {
//     hostedZoneName: `${this.zone.zoneName}.`,
//     name: sesIdentity.attrDkimDnsTokenName1,
//     type: 'CNAME',
//     resourceRecords: [sesIdentity.attrDkimDnsTokenValue1],
//     ttl: '1800',
//   })

//   new route53.CfnRecordSet(this, 'DkimRecord2', {
//     hostedZoneName: `${this.zone.zoneName}.`,
//     name: sesIdentity.attrDkimDnsTokenName2,
//     type: 'CNAME',
//     resourceRecords: [sesIdentity.attrDkimDnsTokenValue2],
//     ttl: '1800',
//   })

//   new route53.CfnRecordSet(this, 'DkimRecord3', {
//     hostedZoneName: `${this.zone.zoneName}.`,
//     name: sesIdentity.attrDkimDnsTokenName3,
//     type: 'CNAME',
//     resourceRecords: [sesIdentity.attrDkimDnsTokenValue3],
//     ttl: '1800',
//   })

//   new route53.MxRecord(this, 'MxRecord', {
//     zone: this.zone,
//     recordName: 'mail',
//     values: [{
//       priority: 10,
//       hostName: 'feedback-smtp.us-east-1.amazonses.com',
//     }],
//   })

//   new route53.TxtRecord(this, 'TxtSpfRecord', {
//     zone: this.zone,
//     recordName: 'mail',
//     values: ['v=spf1 include:amazonses.com ~all'],
//   })

//   new route53.TxtRecord(this, 'TxtDmarcRecord', {
//     zone: this.zone,
//     recordName: '_dmarc',
//     values: [`v=DMARC1;p=quarantine;pct=25;rua=mailto:dmarcreports@${this.domain}`],
//   })

//   const lambdaEmailOutboundRole = new iam.Role(this, 'LambdaEmailOutboundRole', {
//     roleName: `${this.appName}-${appEnv}-email-outbound`,
//     assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
//     managedPolicies: [
//       iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
//     ],
//   })

//   const lambdaEmailOutbound = new lambda.Function(this, 'LambdaEmailOutbound', {
//     functionName: `${this.appName}-${appEnv}-email-outbound`,
//     description: 'Take the JSON and convert it in to an raw email.',
//     code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
//     handler: 'index.handler',
//     memorySize: 256,
//     runtime: lambda.Runtime.NODEJS_18_X,
//     timeout: Duration.seconds(60),
//     environment: {
//       BUCKET: this.storage.emailBucket.bucketName,
//     },
//     role: lambdaEmailOutboundRole,
//   })

//   lambdaEmailOutboundRole.addToPolicy(policyStatement)

//   const sesPolicyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: ['ses:SendRawEmail'],
//     resources: ['*'],
//   })

//   lambdaEmailOutboundRole.addToPolicy(sesPolicyStatement)

//   const lambdaEmailInboundRole = new iam.Role(this, 'LambdaEmailInboundRole', {
//     roleName: `${this.appName}-${appEnv}-email-inbound`,
//     assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
//     managedPolicies: [
//       iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
//     ],
//   })

//   const lambdaEmailInbound = new lambda.Function(this, 'LambdaEmailInbound', {
//     functionName: `${this.appName}-${appEnv}-email-inbound`,
//     description: 'This Lambda organizes all the incoming emails based on the From and To field.',
//     code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
//     handler: 'index.handler',
//     memorySize: 256,
//     role: lambdaEmailInboundRole,
//     runtime: lambda.Runtime.NODEJS_18_X,
//     timeout: Duration.seconds(60),
//     environment: {
//       BUCKET: this.storage.emailBucket.bucketName,
//     },
//   })

//   new lambda.CfnPermission(this, 'S3InboundPermission', {
//     action: 'lambda:InvokeFunction',
//     functionName: lambdaEmailInbound.functionName,
//     principal: 's3.amazonaws.com',
//   })

//   const inboundS3PolicyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: ['s3:*'],
//     resources: [
//       this.storage.emailBucket.bucketArn,
//       `${this.storage.emailBucket.bucketArn}/*`,
//     ],
//   })

//   lambdaEmailInboundRole.addToPolicy(inboundS3PolicyStatement)

//   const sesInboundPolicyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: ['ses:ListIdentities'],
//     resources: ['*'],
//   })

//   lambdaEmailInboundRole.addToPolicy(sesInboundPolicyStatement)

//   const lambdaEmailConverterRole = new iam.Role(this, 'LambdaEmailConverterRole', {
//     roleName: `${this.appName}-${appEnv}-email-converter`,
//     assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
//     managedPolicies: [
//       iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
//     ],
//   })

//   const lambdaEmailConverter = new lambda.Function(this, 'LambdaEmailConverter', {
//     functionName: `${this.appName}-${appEnv}-email-converter`,
//     description: 'This Lambda converts raw emails files in to HTML and text.',
//     code: lambda.Code.fromInline('exports.handler = async (event) => {console.log("hello world email converter");return true;};'), // this needs to be updated with the real lambda code
//     handler: 'index.handler',
//     memorySize: 256,
//     role: lambdaEmailConverterRole,
//     runtime: lambda.Runtime.NODEJS_18_X,
//     timeout: Duration.seconds(60),
//     environment: {
//       BUCKET: this.storage.emailBucket.bucketName,
//     },
//   })

//   const converterS3PolicyStatement = new iam.PolicyStatement({
//     effect: iam.Effect.ALLOW,
//     actions: ['s3:*'],
//     resources: [
//       this.storage.emailBucket.bucketArn,
//       `${this.storage.emailBucket.bucketArn}/*`,
//     ],
//   })

//   new lambda.CfnPermission(this, 'S3ConverterPermission', {
//     action: 'lambda:InvokeFunction',
//     functionName: lambdaEmailConverter.functionName,
//     principal: 's3.amazonaws.com',
//   })

//   lambdaEmailConverterRole.addToPolicy(converterS3PolicyStatement)

//   this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(lambdaEmailInbound), { prefix: 'tmp/email_in/' })
//   this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(lambdaEmailOutbound), { prefix: 'tmp/email_out/json/' })
//   this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_COPY, new s3n.LambdaDestination(lambdaEmailConverter), { prefix: 'sent/' })
//   this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_COPY, new s3n.LambdaDestination(lambdaEmailConverter), { prefix: 'inbox/' })
//   this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_COPY, new s3n.LambdaDestination(lambdaEmailConverter), { prefix: 'today/' })
// }

// const bucket = new s3.Bucket(this, 'EmailServerBucket', {
//   bucketName: `${bucketPrefix}-email-${partialAppKey}`,
//   versioned: true,
//   removalPolicy: RemovalPolicy.DESTROY,
//   autoDeleteObjects: true,
//   encryption: s3.BucketEncryption.S3_MANAGED,
//   lifecycleRules: [
//     {
//       id: '24h',
//       enabled: true,
//       expiration: Duration.days(1),
//       noncurrentVersionExpiration: Duration.days(1),
//       prefix: 'today/',
//     },
//     {
//       id: 'Intelligent transition for Inbox',
//       enabled: true,
//       prefix: 'inbox/',
//       transitions: [
//         {
//           storageClass: s3.StorageClass.INTELLIGENT_TIERING,
//           transitionAfter: Duration.days(0),
//         },
//       ],
//     },
//     {
//       id: 'Intelligent transition for Sent',
//       enabled: true,
//       prefix: 'sent/',
//       transitions: [
//         {
//           storageClass: s3.StorageClass.INTELLIGENT_TIERING,
//           transitionAfter: Duration.days(0),
//         },
//       ],
//     },
//   ],
// })

// Tags.of(bucket).add('daily-backup', 'true')
