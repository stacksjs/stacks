/* eslint-disable no-new */
import type { Construct } from 'constructs'
import type { StackProps } from 'aws-cdk-lib'
import {
  Duration,
  CfnOutput as Output,
  RemovalPolicy,
  Stack,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_lambda as lambda,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_route53_targets as targets,
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib'
import { hasFiles } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import { app, cloud } from '@stacksjs/config'

export class StacksCloud extends Stack {
  domain: string
  apiDomain: string
  apiVanityUrl?: string
  vanityUrl: string
  docsSource: string
  websiteSource: string
  privateSource: string
  zone: route53.IHostedZone
  storage: {
    publicBucket: s3.Bucket
    privateBucket: s3.Bucket
    logBucket: s3.Bucket | undefined
  }
  cdn: cloudfront.Distribution
  certificate: acm.Certificate
  firewall: wafv2.CfnWebACL
  originAccessIdentity: cloudfront.OriginAccessIdentity
  cdnCachePolicy: cloudfront.CachePolicy

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    if (!app.url)
      throw new Error('Your ./config app.url needs to be defined in order to deploy. You may need to adjust the APP_URL inside your .env file.')

    this.domain = app.url
    this.apiDomain = `${app.subdomains?.api || 'api'}.${app.url}`
    this.docsSource = '../../../storage/framework/docs'
    this.websiteSource = app.docMode ? this.docsSource : '../../../storage/public'
    this.privateSource = '../../../storage/private'

    this.zone = this.manageZone()
    this.certificate = this.manageCertificate()
    this.storage = this.manageStorage()
    this.firewall = this.manageFirewall()

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
    return cloud.deploy?.api
  }

  apiCachePolicy() {
   return new cloudfront.CachePolicy(this, 'StacksApiCachePolicy', {
      comment: 'Custom Stacks API Cache Policy',
      cachePolicyName: 'StacksApiCachePolicy',
      // minTtl: cloud.cdn?.minTtl ? Duration.seconds(cloud.cdn.minTtl) : undefined,
      defaultTtl: Duration.seconds(0),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept', 'x-api-key', 'Authorization'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    })
  }

  deployApi(): lambda.FunctionUrl {
    const layer = new lambda.LayerVersion(this, 'StacksLambdaLayer', {
      code: lambda.Code.fromAsset(p.projectStoragePath('framework/cloud/bun-lambda-layer.zip')),
      compatibleRuntimes: [lambda.Runtime.PROVIDED_AL2],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      license: 'MIT',
      description: 'Bun is an incredibly fast JavaScript runtime, bundler, transpiler, and package manager.',
    })

    const stacksServerFunction = new lambda.Function(this, 'StacksServer', {
      description: 'The Stacks API',
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        TEST_ENV: 'test',
      },
      code: lambda.Code.fromAsset(p.projectStoragePath('framework/api/lambda.zip')),
      handler: 'index.handler',
      runtime: lambda.Runtime.PROVIDED_AL2,
      layers: [layer],
    })

    const api = new lambda.FunctionUrl(this, 'StacksServerUrl', {
      function: stacksServerFunction,
      authType: lambda.FunctionUrlAuthType.NONE, // becomes a public API
      cors: {
        allowedOrigins: ['*'],
      },
    })

    this.apiVanityUrl = api.url

    return api
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
        return cloudfront.CacheCookieBehavior.allowList(...cloud.cdn?.allowList.cookies || [])
      default:
        return undefined
    }
  }

  allowedMethods(): cloudfront.AllowedMethods {
    switch (cloud.cdn?.allowedMethods) {
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
    switch (cloud.cdn?.cachedMethods) {
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

    new route53.CnameRecord(this, 'WwwCnameRecord', {
      zone: this.zone,
      recordName: 'www',
      domainName: this.domain,
    })
  }

  manageZone() {
    return new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: this.domain,
    })
  }

  manageCertificate() {
    return new acm.Certificate(this, 'WebsiteCertificate', {
      domainName: this.domain,
      validation: acm.CertificateValidation.fromDns(this.zone),
    })
  }

  manageStorage() {
    const publicBucket = new s3.Bucket(this, 'PublicBucket', {
      bucketName: `${this.domain}-${app.env}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const privateBucket = new s3.Bucket(this, 'PrivateBucket', {
      bucketName: `${this.domain}-private-${app.env}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create an S3 bucket for CloudFront access logs
    let logBucket: s3.Bucket | undefined

    if (cloud.cdn?.enableLogging) {
      logBucket = new s3.Bucket(this, 'LogBucket', {
        bucketName: `${this.domain}-logs-${app.env}`,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      })
    }

    return {
      publicBucket,
      privateBucket,
      logBucket,
    }
  }

  manageFirewall() {
    return new wafv2.CfnWebACL(this, 'WebAcl', {
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

  manageCdn() {
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI')

    const cdnCachePolicy = new cloudfront.CachePolicy(this, 'cdnCachePolicy', {
      comment: 'Custom Stacks CDN Cache Policy',
      cachePolicyName: 'cdnCachePolicy',
      minTtl: cloud.cdn?.minTtl ? Duration.seconds(cloud.cdn.minTtl) : undefined,
      defaultTtl: cloud.cdn?.defaultTtl ? Duration.seconds(cloud.cdn.defaultTtl) : undefined,
      maxTtl: cloud.cdn?.maxTtl ? Duration.seconds(cloud.cdn.maxTtl) : undefined,
      cookieBehavior: this.getCookieBehavior(cloud.cdn?.cookieBehavior),
    })

    const cdn = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [this.domain],
      defaultRootObject: 'index.html',
      comment: `CDN for ${app.url}`,
      certificate: this.certificate,
      enableLogging: cloud.cdn?.enableLogging,
      logBucket: cloud.cdn?.enableLogging ? this.storage.logBucket : undefined,
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
        compress: cloud.cdn?.compress,
        allowedMethods: this.allowedMethods(),
        cachedMethods: this.cachedMethods(),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: this.cdnCachePolicy,
      },

      additionalBehaviors: this.additionalBehaviors(),
    })

    return { cdn, originAccessIdentity, cdnCachePolicy }
  }

  additionalBehaviors(): Record<string, cloudfront.BehaviorOptions> {
    let behaviorOptions: Record<string, cloudfront.BehaviorOptions> = {}

    if (this.shouldDeployApi()) {
      this.deployApi()

      behaviorOptions = {
        '/api/*': {
          origin: new origins.HttpOrigin(this.apiDomain, {
            originPath: '/',
          }),
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: this.apiCachePolicy(),
        }
      }
    }

    if (this.shouldDeployDocs()) {
      const docsBucket = new s3.Bucket(this, 'DocsBucket', {
        bucketName: `docs.${this.domain}-${app.env}`,
        versioned: true,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      })

      behaviorOptions = {
        ...behaviorOptions,
        '/docs/*': {
          origin: new origins.S3Origin(docsBucket, {
            originAccessIdentity: this.originAccessIdentity,
          }),
          compress: true,
          allowedMethods: this.allowedMethodsFromString(cloud.cdn?.allowedMethods),
          cachedMethods: this.cachedMethodsFromString(cloud.cdn?.cachedMethods),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      }
    }

    return behaviorOptions
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
      value: `https://${this.apiDomain}`,
      description: 'The URL of the deployed application',
    })

    if (this.apiVanityUrl) {
      new Output(this, 'ApiVanityUrl', {
        value: this.apiVanityUrl,
        description: 'The vanity URL of the deployed Stacks server.',
      })
    }

    // Output the nameservers of the hosted zone
    // new Output(this, 'Nameservers', {
    //   value: Fn.join(', ', zone.hostedZoneNameServers),
    //   description: 'Nameservers for the application domain',
    // })
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
