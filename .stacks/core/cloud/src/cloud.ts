/* eslint-disable no-new */
import type { Construct } from 'constructs'
import type {
  CfnResource,
  StackProps,
} from 'aws-cdk-lib'
import {
  Duration,
  Fn,
  CfnOutput as Output,
  RemovalPolicy,
  SecretValue,
  Stack,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  // custom_resources,
  aws_ec2 as ec2,
  aws_efs as efs,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_s3_notifications as s3n,
  aws_secretsmanager as secretsmanager,
  aws_ses as ses,
  aws_route53_targets as targets,
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib'
import { ListBucketsCommand, S3 } from '@aws-sdk/client-s3'
import { string } from '@stacksjs/strings'
import { hasFiles } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import type { EnvKey } from '~/storage/framework/stacks/env'

const appEnv = config.app.env === 'local' ? 'dev' : config.app.env
const timestamp = new Date().getTime()
const s3Sdk = new S3()

function isProductionEnv(env: string) {
  return env === 'production' || env === 'prod'
}

export class StacksCloud extends Stack {
  domain!: string
  appName = config.app.name?.toLocaleLowerCase() || 'stacks'
  teamName = config.team.name.toLowerCase() || 'stacks'
  apiPrefix!: string
  docsPrefix?: string
  apiVanityUrl!: string
  vanityUrl!: string
  docsSource!: string
  websiteSource!: string
  privateSource!: string
  zone!: route53.IHostedZone
  redirectZones: route53.IHostedZone[] = []
  ec2Instance?: ec2.Instance
  vpc!: ec2.Vpc

  storage!: {
    publicBucket: s3.Bucket | s3.IBucket
    privateBucket: s3.Bucket | s3.IBucket
    emailBucket?: s3.Bucket | s3.IBucket
    logBucket: s3.Bucket | undefined
    fileSystem?: efs.FileSystem | undefined
    accessPoint?: efs.AccessPoint | undefined
  }

  cdn!: cloudfront.Distribution
  certificate!: acm.Certificate
  firewall!: wafv2.CfnWebACL
  originAccessIdentity!: cloudfront.OriginAccessIdentity
  cdnCachePolicy!: cloudfront.CachePolicy
  apiCachePolicy: cloudfront.CachePolicy | undefined

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
  }

  async init() {
    // this is a noop function that is used to ensure the constructor is called
    // @ts-expect-error – we know this was properly set when needed
    this.storage = {}

    if (!config.app.url)
      throw new Error('Your ./config app.url needs to be defined in order to deploy. You may need to adjust the APP_URL inside your .env file.')

    if (!config.team || Object.keys(config.team).length === 0)
      throw new Error('Your ./config team needs to at least have one member defined. Please set yourself as a team member and try deploying again.')

    if (isProductionEnv(appEnv || 'dev'))
      this.domain = config.app.url
    else
      this.domain = `${appEnv}.${config.app.url}`

    this.apiPrefix = config.api.prefix || 'api'
    this.docsPrefix = config.app.docMode ? undefined : config.docs.base
    this.docsSource = '../../../storage/framework/docs'
    this.websiteSource = config.app.docMode ? this.docsSource : '../../../storage/public'
    this.privateSource = '../../../storage/private'
    this.apiVanityUrl = ''

    this.manageUsers()
    this.manageZone()
    await this.manageEmailServer()
    this.manageCertificate()
    await this.manageStorage()
    this.manageFirewall()
    this.manageFileSystem()

    // this also deploys your API
    const { cdn, originAccessIdentity, cdnCachePolicy } = this.manageCdn()
    this.cdn = cdn
    this.originAccessIdentity = originAccessIdentity
    this.cdnCachePolicy = cdnCachePolicy
    this.vanityUrl = `https://${this.cdn.domainName}`

    // needs to run after the cdn is created because it links the distribution
    this.manageDns()
    this.deploy()
    this.addOutputs()
  }

  shouldDeployDocs() {
    return hasFiles(p.projectPath('docs'))
  }

  shouldDeployApi() {
    return config.cloud.deploy?.api
  }

  setApiCachePolicy() {
    if (this.apiCachePolicy)
      return this.apiCachePolicy

    this.apiCachePolicy = new cloudfront.CachePolicy(this, 'StacksApiCachePolicy', {
      comment: 'Stacks API Cache Policy',
      cachePolicyName: `${this.appName}-${appEnv}-api-cache-policy`,
      // minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: Duration.seconds(0),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept', 'x-api-key', 'Authorization'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    })

    return this.apiCachePolicy
  }

  deployApi() {
    const layer = new lambda.LayerVersion(this, 'StacksLambdaLayer', {
      code: lambda.Code.fromAsset(p.projectStoragePath('framework/cloud/bun-lambda-layer.zip')),
      compatibleRuntimes: [lambda.Runtime.PROVIDED_AL2],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      license: 'MIT',
      description: 'Bun is an incredibly fast JavaScript runtime, bundler, transpiler, and package manager.',
    })

    const keysToRemove = ['_HANDLER', '_X_AMZN_TRACE_ID', 'AWS_REGION', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION', 'AWS_LAMBDA_INITIALIZATION_TYPE', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME', 'AWS_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_LAMBDA_RUNTIME_API', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', '_']
    keysToRemove.forEach(key => delete env[key as EnvKey])

    const secrets = new secretsmanager.Secret(this, 'StacksSecrets', {
      secretName: `${this.appName}-${appEnv}-secrets`,
      description: 'Secrets for the Stacks application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify(env),
        generateStringKey: Object.keys(env).join(',').length.toString(),
      },
    })

    const functionName = `${this.appName}-${appEnv}-server`
    const serverFunction = new lambda.Function(this, 'StacksServer', {
      functionName,
      description: 'The Stacks Server',
      memorySize: 512,
      vpc: this.vpc,
      filesystem: lambda.FileSystem.fromEfsAccessPoint(this.storage.accessPoint!, '/mnt/efs'),
      timeout: Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      code: lambda.Code.fromAsset(p.projectStoragePath('framework/cloud/lambda.zip')),
      handler: 'server.fetch',
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.ARM_64,
      layers: [layer],
    })

    secrets.grantRead(serverFunction)
    serverFunction.addEnvironment('SECRETS_ARN', secrets.secretArn)

    const api = new lambda.FunctionUrl(this, 'StacksServerUrl', {
      function: serverFunction,
      authType: lambda.FunctionUrlAuthType.NONE, // becomes a public API
      cors: {
        allowedOrigins: ['*'],
      },
    })

    this.apiVanityUrl = api.url
  }

  allowedMethodsFromString(methods?: 'ALL' | 'GET_HEAD' | 'GET_HEAD_OPTIONS'): cloudfront.AllowedMethods {
    if (!methods)
      return cloudfront.AllowedMethods.ALLOW_ALL

    switch (methods) {
      case 'ALL':
        return cloudfront.AllowedMethods.ALLOW_ALL
      case 'GET_HEAD':
        return cloudfront.AllowedMethods.ALLOW_GET_HEAD
      case 'GET_HEAD_OPTIONS':
        return cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS
      default:
        return cloudfront.AllowedMethods.ALLOW_ALL
    }
  }

  cachedMethodsFromString(methods?: 'GET_HEAD' | 'GET_HEAD_OPTIONS'): cloudfront.CachedMethods {
    if (!methods)
      return cloudfront.CachedMethods.CACHE_GET_HEAD

    switch (methods) {
      case 'GET_HEAD':
        return cloudfront.CachedMethods.CACHE_GET_HEAD
      case 'GET_HEAD_OPTIONS':
        return cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS
      default:
        return cloudfront.CachedMethods.CACHE_GET_HEAD
    }
  }

  getCookieBehavior(behavior: string | undefined): cloudfront.CacheCookieBehavior | undefined {
    switch (behavior) {
      case 'all':
        return cloudfront.CacheCookieBehavior.all()
      case 'none':
        return cloudfront.CacheCookieBehavior.none()
      case 'allowList':
        // If you have a list of cookies, replace `myCookie` with your cookie
        return cloudfront.CacheCookieBehavior.allowList(...config.cloud.cdn?.allowList.cookies || [])
      default:
        return undefined
    }
  }

  allowedMethods(): cloudfront.AllowedMethods {
    switch (config.cloud.cdn?.allowedMethods) {
      case 'ALL':
        return cloudfront.AllowedMethods.ALLOW_ALL
      case 'GET_HEAD':
        return cloudfront.AllowedMethods.ALLOW_GET_HEAD
      case 'GET_HEAD_OPTIONS':
        return cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS
      default:
        return cloudfront.AllowedMethods.ALLOW_ALL
    }
  }

  cachedMethods(): cloudfront.CachedMethods {
    switch (config.cloud.cdn?.cachedMethods) {
      case 'GET_HEAD':
        return cloudfront.CachedMethods.CACHE_GET_HEAD
      case 'GET_HEAD_OPTIONS':
        return cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS
      default:
        return cloudfront.CachedMethods.CACHE_GET_HEAD
    }
  }

  manageDns() {
    // Create a Route53 record pointing to the CloudFront distribution
    new route53.ARecord(this, 'AliasRecord', {
      recordName: this.domain,
      zone: this.zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.cdn)),
    })
  }

  manageUsers() {
    const teamName = config.team.name
    const users = config.team.members
    const password = env.AWS_DEFAULT_PASSWORD || string.random()

    for (const userName in users) {
      // const userEmail = users[userName]
      const name = `${string.pascalCase(teamName)}${string.pascalCase(userName)}User`
      const user = new iam.User(this, name, {
        userName,
        password: SecretValue.unsafePlainText(password),
        passwordResetRequired: true,
      })

      user.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

      // TODO: email the userEmail their credentials
    }
  }

  manageZone() {
    // lets see if the zone already exists
    this.zone = route53.PublicHostedZone.fromLookup(this, 'AppUrlHostedZone', {
      domainName: this.domain,
    })

    // TODO: fix this – redirects do not work yet
    // config.dns.redirects?.forEach((redirect) => {
    //   const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
    //   const hostedZone = route53.HostedZone.fromLookup(this, `RedirectHostedZone${slug}`, { domainName: redirect })
    //   this.redirectZones.push(hostedZone)
    // })
  }

  manageCertificate() {
    this.certificate = new acm.Certificate(this, 'StacksCertificate', {
      domainName: this.domain,
      validation: acm.CertificateValidation.fromDns(this.zone),
      subjectAlternativeNames: [`www.${this.domain}`],
    })
  }

  async manageStorage() {
    // the bucketName cannot contain the domainName because when it is changed,
    // this resource needs to stay around/is retained. Hence, the domainName
    // does not make much sense using as a (linking) identifier

    const publicBucket = await this.getPublicBucket()
    // for each redirect, create a bucket & redirect it to the APP_URL
    config.dns.redirects?.forEach((redirect) => {
      // TODO: use string-ts function here instead
      const slug = redirect.split('.').map((part, index) => index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)).join('') // creates a CamelCase slug from the redirect
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: redirect })
      const redirectBucket = new s3.Bucket(this, `RedirectBucket${slug}`, {
        bucketName: `${redirect}-redirect`,
        websiteRedirect: {
          hostName: this.domain,
          protocol: s3.RedirectProtocol.HTTPS,
        },
        removalPolicy: RemovalPolicy.DESTROY,
      })
      new route53.CnameRecord(this, `RedirectRecord${slug}`, {
        zone: hostedZone,
        recordName: 'redirect',
        domainName: redirectBucket.bucketWebsiteDomainName,
      })
    })

    const privateBucket = await this.getPrivateBucket()

    let logBucket: s3.Bucket | undefined
    if (config.cloud.cdn?.enableLogging) {
      logBucket = new s3.Bucket(this, 'LogBucket', {
        bucketName: `${this.appName}-logs-${appEnv}-${timestamp}`,
        removalPolicy: RemovalPolicy.RETAIN,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      })
    }

    this.storage = {
      publicBucket,
      privateBucket,
      emailBucket: this.storage?.emailBucket,
      logBucket,
    }
  }

  manageFirewall() {
    this.firewall = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} }, // Default action is to allow requests
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'webAclMetric',
      },
      // rules: security.appFirewall?.rules,
    })
  }

  manageFileSystem() {
    this.vpc = new ec2.Vpc(this, 'Network', {
      maxAzs: 2,
      // natGateways: 1,
    })

    this.storage.fileSystem = new efs.FileSystem(this, 'StacksFileSystem', {
      vpc: this.vpc,
      fileSystemName: `${this.appName}-${appEnv}-efs`,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      enableAutomaticBackups: true,
      encrypted: true,
    })

    const role = new iam.Role(this, 'JumpBoxInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    })

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    // this instance needs to be created once to mount the EFS & clone the Stacks repo
    this.ec2Instance = new ec2.Instance(this, 'JumpBox', {
      vpc: this.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      role,
      userData: ec2.UserData.custom(`
      #!/bin/bash
      yum update -y
      yum install -y amazon-efs-utils
      yum install -y git
      yum install -y https://s3.us-east-1.amazonaws.com/amazon-ssm-us-east-1/latest/linux_amd64/amazon-ssm-agent.rpm
      mkdir /mnt/efs
      mount -t efs ${this.storage.fileSystem.fileSystemId}:/ /mnt/efs
      git clone https://github.com/stacksjs/stacks.git /mnt/efs
    `),
    })

    this.storage.accessPoint = new efs.AccessPoint(this, 'StacksAccessPoint', {
      fileSystem: this.storage.fileSystem,
      path: '/',
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    })
  }

  manageCdn() {
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI')

    const cdnCachePolicy = new cloudfront.CachePolicy(this, 'CdnCachePolicy', {
      comment: 'Stacks CDN Cache Policy',
      cachePolicyName: `${this.appName}-${appEnv}-cdn-cache-policy`,
      minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: config.cloud.cdn?.defaultTtl ? Duration.seconds(config.cloud.cdn.defaultTtl) : undefined,
      maxTtl: config.cloud.cdn?.maxTtl ? Duration.seconds(config.cloud.cdn.maxTtl) : undefined,
      cookieBehavior: this.getCookieBehavior(config.cloud.cdn?.cookieBehavior),
    })

    // this edge function ensures pretty docs urls
    // and it will soon be reused for our Meema features
    const originRequestFunction = new lambda.Function(this, 'OriginRequestFunction', {
      functionName: `${this.appName}-${appEnv}-origin-request`,
      description: 'The Stacks Origin Request function that prettifies URLs',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/origin-request.handler',
      code: lambda.Code.fromAsset(p.corePath('cloud/dist.zip')),
    })

    // applying this is a workaround for failing deployments due to the following DELETE_FAILED error:
    // > Resource handler returned message: "Lambda was unable to delete arn:aws:lambda:us-east-1:92330274019:function:stacks-cloud-production-OriginRequestFunction4FA39-XQadJcSWY8Lz:1 because it is a replicated function. Please see our documentation for Deleting Lambda@Edge Functions and Replicas. (Service: Lambda, Status Code: 400, Request ID: 83bd3112-aaa4-4980-bfcf-3ee2052a0435)" (RequestToken: c91aed31-1a62-9425-c25d-4fc0fccfa45f, HandlerErrorCode: InvalidRequest)
    // if we do not delete this resource, then it circumvents trying to delete the function and the deployment succeeds
    // buddy cloud:cleanup is what will be suggested running after user ensured no more sensitive data is in the buckets
    const cfnOriginRequestFunction = originRequestFunction.node.defaultChild as CfnResource
    cfnOriginRequestFunction.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const cdn = new cloudfront.Distribution(this, 'Cdn', {
      domainNames: [this.domain],
      defaultRootObject: 'index.html',
      comment: `CDN for ${config.app.url}`,
      certificate: this.certificate,
      enableLogging: config.cloud.cdn?.enableLogging,
      logBucket: config.cloud.cdn?.enableLogging ? this.storage.logBucket : undefined,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: this.firewall.attrArn,
      enableIpv6: true,

      defaultBehavior: {
        origin: new origins.S3Origin(this.storage.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
        }),
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: originRequestFunction.currentVersion,
          },
        ],
        compress: config.cloud.cdn?.compress,
        allowedMethods: this.allowedMethods(),
        cachedMethods: this.cachedMethods(),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: this.cdnCachePolicy,
      },

      additionalBehaviors: this.additionalBehaviors(),

      // Add custom error responses
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
          ttl: Duration.seconds(0),
        },
      ],
    })

    // setup the www redirect
    // Create a bucket for www.yourdomain.com and configure it to redirect to yourdomain.com
    const wwwBucket = new s3.Bucket(this, 'WwwBucket', {
      bucketName: `www.${this.domain}`,
      websiteRedirect: {
        hostName: this.domain,
        protocol: s3.RedirectProtocol.HTTPS,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Create a Route53 record for www.yourdomain.com
    new route53.ARecord(this, 'WwwAliasRecord', {
      recordName: `www.${this.domain}`,
      zone: this.zone,
      target: route53.RecordTarget.fromAlias(new targets.BucketWebsiteTarget(wwwBucket)),
    })

    return { cdn, originAccessIdentity, cdnCachePolicy }
  }

  async manageEmailServer() {
    this.storage.emailBucket = await this.getEmailBucket()

    const sesPrincipal = new iam.ServicePrincipal('ses.amazonaws.com')
    const bucketPolicyStatement = new iam.PolicyStatement({
      sid: 'AllowSESPuts',
      effect: iam.Effect.ALLOW,
      principals: [sesPrincipal],
      actions: ['s3:PutObject'],
      resources: [this.storage.emailBucket.arnForObjects('tmp/email_in/*')],
      conditions: {
        StringEquals: {
          'aws:Referer': this.account,
        },
      },
    })

    this.storage.emailBucket?.addToResourcePolicy(bucketPolicyStatement)

    const iamGroup = new iam.Group(this, 'IAMGroup', {
      groupName: `${this.appName}-${appEnv}-email-management-s3-group`,
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
      resources: [
        `arn:aws:s3:::${this.storage.emailBucket.bucketName}`,
        `arn:aws:s3:::${this.storage.emailBucket.bucketName}/*`,
      ],
    })

    const policy = new iam.Policy(this, 'EmailAccessPolicy', {
      statements: [policyStatement, listBucketsPolicyStatement],
    })

    iamGroup.attachInlinePolicy(policy)

    // Create a SES domain identity
    const sesIdentity = new ses.CfnEmailIdentity(this, 'DomainIdentity', {
      emailIdentity: this.domain,

      dkimSigningAttributes: {
        nextSigningKeyLength: 'RSA_2048_BIT',
      },

      dkimAttributes: {
        signingEnabled: true,
      },

      mailFromAttributes: {
        behaviorOnMxFailure: 'USE_DEFAULT_VALUE',
        mailFromDomain: `mail.${this.domain}`,
      },

      feedbackAttributes: {
        emailForwardingEnabled: true,
      },
    })

    // Create a Route53 records for the SES domain identity
    // https://github.com/aws/aws-cdk/issues/21306
    new route53.CfnRecordSet(this, 'DkimRecord1', {
      hostedZoneName: `${this.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName1,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue1],
      ttl: '1800',
    })

    new route53.CfnRecordSet(this, 'DkimRecord2', {
      hostedZoneName: `${this.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName2,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue2],
      ttl: '1800',
    })

    new route53.CfnRecordSet(this, 'DkimRecord3', {
      hostedZoneName: `${this.zone.zoneName}.`,
      name: sesIdentity.attrDkimDnsTokenName3,
      type: 'CNAME',
      resourceRecords: [sesIdentity.attrDkimDnsTokenValue3],
      ttl: '1800',
    })

    new route53.MxRecord(this, 'MxRecord', {
      zone: this.zone,
      recordName: 'mail',
      values: [{
        priority: 10,
        hostName: 'feedback-smtp.us-east-1.amazonses.com',
      }],
    })

    new route53.TxtRecord(this, 'TxtSpfRecord', {
      zone: this.zone,
      recordName: 'mail',
      values: ['v=spf1 include:amazonses.com ~all'],
    })

    new route53.TxtRecord(this, 'TxtDmarcRecord', {
      zone: this.zone,
      recordName: '_dmarc',
      values: [`v=DMARC1;p=quarantine;pct=25;rua=mailto:dmarcreports@${this.domain}`],
    })

    const ruleSet = new ses.CfnReceiptRuleSet(this, 'SESReceiptRuleSet', {
      ruleSetName: `${this.appName}-${appEnv}-email`,
    })

    new ses.CfnReceiptRule(this, 'SESReceiptRule', {
      ruleSetName: ruleSet.ref,
      rule: {
        name: 'Inbound',
        enabled: true,
        actions: [
          {
            s3Action: {
              bucketName: this.storage.emailBucket.bucketName,
              objectKeyPrefix: 'tmp/email_in',
            },
          },
        ],
        scanEnabled: config.email.server?.scan,
        tlsPolicy: 'Require',
      },
    })

    const lambdaEmailOutboundRole = new iam.Role(this, 'LambdaEmailOutboundRole', {
      roleName: `${this.appName}-${appEnv}-email-outbound`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    const lambdaEmailOutbound = new lambda.Function(this, 'LambdaEmailOutbound', {
      functionName: `${this.appName}-${appEnv}-email-outbound`,
      description: 'Take the JSON and convert it in to an raw email.',
      code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.storage.emailBucket.bucketName,
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

    const lambdaEmailInboundRole = new iam.Role(this, 'LambdaEmailInboundRole', {
      roleName: `${this.appName}-${appEnv}-email-inbound`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    const lambdaEmailInbound = new lambda.Function(this, 'LambdaEmailInbound', {
      functionName: `${this.appName}-${appEnv}-email-inbound`,
      description: 'This Lambda organizes all the incoming emails based on the From and To field.',
      code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      role: lambdaEmailInboundRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.storage.emailBucket.bucketName,
      },
    })

    new lambda.CfnPermission(this, 'S3InboundPermission', {
      action: 'lambda:InvokeFunction',
      functionName: lambdaEmailInbound.functionName,
      principal: 's3.amazonaws.com',
    })

    const inboundS3PolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [
        `arn:aws:s3:::${this.storage.emailBucket.bucketName}`,
        `arn:aws:s3:::${this.storage.emailBucket.bucketName}/*`,
      ],
    })

    lambdaEmailInboundRole.addToPolicy(inboundS3PolicyStatement)

    const sesInboundPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:ListIdentities'],
      resources: ['*'],
    })

    lambdaEmailInboundRole.addToPolicy(sesInboundPolicyStatement)

    const lambdaEmailConverterRole = new iam.Role(this, 'LambdaEmailConverterRole', {
      roleName: `${this.appName}-${appEnv}-email-converter`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    const lambdaEmailConverter = new lambda.Function(this, 'LambdaEmailConverter', {
      functionName: `${this.appName}-${appEnv}-email-converter`,
      description: 'This Lambda converts raw emails files in to HTML and text.',
      code: lambda.Code.fromInline('exports.handler = async (event) => {return true;};'), // this needs to be updated with the real lambda code
      handler: 'index.handler',
      memorySize: 256,
      role: lambdaEmailConverterRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(60),
      environment: {
        BUCKET: this.storage.emailBucket.bucketName,
      },
    })

    const converterS3PolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [
      `arn:aws:s3:::${this.storage.emailBucket.bucketName}`,
      `arn:aws:s3:::${this.storage.emailBucket.bucketName}/`,
      ],
    })

    new lambda.CfnPermission(this, 'S3ConverterPermission', {
      action: 'lambda:InvokeFunction',
      functionName: lambdaEmailConverter.functionName,
      principal: 's3.amazonaws.com',
    })

    lambdaEmailConverterRole.addToPolicy(converterS3PolicyStatement)

    // Grant SES permission to write to the S3 bucket
    this.storage.emailBucket.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [this.storage.emailBucket.arnForObjects('*')],
      conditions: {
        StringEquals: {
          'aws:Referer': this.account,
        },
      },
    }))

    this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(lambdaEmailInbound), { prefix: 'tmp/email_in' })
    this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.LambdaDestination(lambdaEmailOutbound), { prefix: 'tmp/email_out/json' })
    this.storage.emailBucket.addEventNotification(s3.EventType.OBJECT_CREATED_COPY, new s3n.LambdaDestination(lambdaEmailConverter), { prefix: 'sent/' })
  }

  additionalBehaviors(): Record<string, cloudfront.BehaviorOptions> {
    let behaviorOptions: Record<string, cloudfront.BehaviorOptions> = {}

    if (this.shouldDeployApi()) {
      this.deployApi()

      behaviorOptions = this.apiBehaviorOptions()
    }

    // if docMode is used, we don't need to add a behavior for the docs
    // because the docs will be the root of the site
    if (this.shouldDeployDocs() && !config.app.docMode) {
      behaviorOptions = {
        ...this.docsBehaviorOptions(),
        ...behaviorOptions,
      }
    }

    return behaviorOptions
  }

  apiBehaviorOptions(): Record<string, cloudfront.BehaviorOptions> {
    const origin = (path: '/api' | '/api/*' = '/api') => new origins.HttpOrigin(Fn.select(2, Fn.split('/', this.apiVanityUrl)), { // removes the https://
      originPath: path,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    })

    return {
      '/api': {
        origin: origin(),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: this.setApiCachePolicy(),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      '/api/*': {
        origin: origin('/api/*'),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: this.apiCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    }
  }

  docsBehaviorOptions(): Record<string, cloudfront.BehaviorOptions> {
    return {
      '/docs': {
        origin: new origins.S3Origin(this.storage.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
          originPath: '/docs',
        }),
        compress: true,
        allowedMethods: this.allowedMethodsFromString(config.cloud.cdn?.allowedMethods),
        cachedMethods: this.cachedMethodsFromString(config.cloud.cdn?.cachedMethods),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      '/docs/*': {
        origin: new origins.S3Origin(this.storage.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
          originPath: '/docs',
        }),
        compress: true,
        allowedMethods: this.allowedMethodsFromString(config.cloud.cdn?.allowedMethods),
        cachedMethods: this.cachedMethodsFromString(config.cloud.cdn?.cachedMethods),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    }
  }

  addOutputs(): void {
    new Output(this, 'AppUrl', {
      value: `https://${this.domain}`,
      description: 'The URL of the deployed application',
    })

    new Output(this, 'AppVanityUrl', {
      value: this.vanityUrl,
      description: 'The vanity URL of the deployed application',
    })

    new Output(this, 'ApiUrl', {
      value: `https://${this.domain}/${this.apiPrefix}`,
      description: 'The URL of the deployed application',
    })

    if (this.apiVanityUrl) {
      new Output(this, 'ApiVanityUrl', {
        value: this.apiVanityUrl,
        description: 'The vanity URL of the deployed Stacks server.',
      })
    }

    if (this.ec2Instance?.instanceId) {
      new Output(this, 'JumpBoxInstanceId', {
        value: this.ec2Instance.instanceId,
        description: 'The ID of the EC2 instance that can be used to SSH into the Stacks Cloud.',
      })
    }

    // if docsPrefix is not set, then we know we are in docsMode and the documentation lives at the root of the domain
    if (this.shouldDeployDocs() && this.docsPrefix) {
      new Output(this, 'DocsUrl', {
        value: `https://${this.domain}/${this.docsPrefix}`,
        description: 'The URL of the deployed documentation',
      })
    }
  }

  async getPublicBucket(): Promise<s3.Bucket | s3.IBucket> {
    const bucketPrefix = `${this.appName}-${appEnv}-`
    const existingBucketName = await getBucketWithPrefix(bucketPrefix)
    const existingBucketArn = `arn:aws:s3:::${existingBucketName}`

    if (existingBucketName)
      return s3.Bucket.fromBucketArn(this, 'ExistingPublicBucket', existingBucketArn)

    return new s3.Bucket(this, 'PublicBucket', {
      bucketName: `${bucketPrefix}${timestamp}`,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
  }

  async getPrivateBucket(): Promise<s3.Bucket | s3.IBucket> {
    const bucketPrefix = `${this.appName}-private-${appEnv}-`
    const existingBucketName = await getBucketWithPrefix(bucketPrefix)
    const existingBucketArn = `arn:aws:s3:::${existingBucketName}`

    if (existingBucketName)
      return s3.Bucket.fromBucketArn(this, 'ExistingPrivateBucket', existingBucketArn)

    return new s3.Bucket(this, 'PrivateBucket', {
      bucketName: `${bucketPrefix}${timestamp}`,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    })
  }

  async getEmailBucket(): Promise<s3.Bucket | s3.IBucket> {
    const bucketPrefix = `${this.appName}-email-${appEnv}-`
    const existingBucketName = await getBucketWithPrefix(bucketPrefix)
    const existingBucketArn = `arn:aws:s3:::${existingBucketName}`

    if (existingBucketName)
      return s3.Bucket.fromBucketArn(this, 'ExistingEmailBucket', existingBucketArn)

    return new s3.Bucket(this, 'EmailServerBucket', {
      bucketName: `${this.appName}-email-${appEnv}-${timestamp}`,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: '24h',
          expiration: Duration.days(1),
          noncurrentVersionExpiration: Duration.days(1),
          prefix: 'today/',
          enabled: true,
        },
      ],
    })
  }

  deploy() {
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(this.websiteSource)],
      destinationBucket: this.storage.publicBucket,
      distribution: this.cdn,
      distributionPaths: ['/*'],
    })

    new s3deploy.BucketDeployment(this, 'DeployPrivateFiles', {
      sources: [s3deploy.Source.asset(this.privateSource)],
      destinationBucket: this.storage.privateBucket,
    })
  }
}

export async function getBucketWithPrefix(prefix: string): Promise<string | null | undefined> {
  const s3 = new S3({ region: 'us-east-1' })

  try {
    const response = await s3.send(new ListBucketsCommand({}))

    const bucket = response.Buckets?.find(bucket => bucket.Name?.startsWith(prefix))

    return bucket ? bucket.Name : null
  }
  catch (error) {
    console.error('Error fetching buckets', error)
    throw error
  }
}
