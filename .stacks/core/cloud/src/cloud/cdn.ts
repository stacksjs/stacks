/* eslint-disable no-new */
import type { CfnResource, NestedStackProps, aws_certificatemanager as acm, aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import {
  AssetHashType,
  Duration,
  Fn,
  NestedStack,
  RemovalPolicy,
  aws_cloudfront as cloudfront,
  aws_lambda as lambda,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_secretsmanager as secretsmanager,
  aws_ssm as ssm,
  aws_route53_targets as targets,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { hasFiles } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import type { EnvKey } from '~/storage/framework/stacks/env'

interface ResourceNestedStackProps extends NestedStackProps {
  env: {
    account: string
    region: string
  }
  appName: string
  appEnv: string
  domain: string
  partialAppKey: string
  zone: route53.HostedZone
  certificate: acm.Certificate
  logBucket: s3.Bucket
  firewall: wafv2.CfnWebACL
  storage: {
    publicBucket: s3.Bucket
    accessPoint: s3.CfnAccessPoint | undefined
  }
}

export class CdnStack extends NestedStack {
  cdn!: cloudfront.Distribution
  originAccessIdentity!: cloudfront.OriginAccessIdentity
  cdnCachePolicy!: cloudfront.CachePolicy
  apiCachePolicy: cloudfront.CachePolicy | undefined
  vanityUrl!: string
  apiVanityUrl!: string
  props: ResourceNestedStackProps

  constructor(scope: Construct, props: ResourceNestedStackProps) {
    super(scope, 'Cdn', props)
    this.props = props
    // ...
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI')

    const cdnCachePolicy = new cloudfront.CachePolicy(this, 'CdnCachePolicy', {
      comment: 'Stacks CDN Cache Policy',
      cachePolicyName: `${props.appName}-${props.appEnv}-cdn-cache-policy`,
      minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: config.cloud.cdn?.defaultTtl ? Duration.seconds(config.cloud.cdn.defaultTtl) : undefined,
      maxTtl: config.cloud.cdn?.maxTtl ? Duration.seconds(config.cloud.cdn.maxTtl) : undefined,
      cookieBehavior: this.getCookieBehavior(config.cloud.cdn?.cookieBehavior),
    })

    // const timestamp = new Date().getTime()

    // Fetch the timestamp from SSM Parameter Store
    const timestampParam = ssm.StringParameter.fromSecureStringParameterAttributes(this, 'TimestampParam', {
      parameterName: `/${this.props.appName.toLowerCase()}/timestamp`,
      version: 1,
    })

    let timestamp = timestampParam.stringValue

    // If the timestamp does not exist, create it
    if (!timestamp) {
      timestamp = new Date().getTime().toString()
      new ssm.StringParameter(this, 'TimestampParam', {
        parameterName: `/${this.props.appName.toLowerCase()}/timestamp`,
        stringValue: timestamp,
      })
    }

    new route53.ARecord(this, 'AliasRecord', {
      recordName: this.props.domain,
      zone: this.props.zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.cdn)),
    })

    // this edge function ensures pretty docs urls
    // soon to be reused for our Meema features
    const originRequestFunction = new lambda.Function(this, 'OriginRequestFunction', {
      // this needs to have partialAppKey & timestamp to ensure it is unique, because there is a chance that during testing, you deploy
      // the same app many times using the same app key. Since Origin Request (Lambda@Edge) functions are replicated functions, the
      // deletion process takes a long time. This is to ensure that the function is always unique in cases of quick recreations.
      functionName: `${this.props.appName}-${this.props.appEnv}-origin-request-${this.props.partialAppKey}-${timestamp}`,
      description: 'The Stacks Origin Request function that prettifies URLs',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'dist/origin-request.handler',
      code: lambda.Code.fromAsset(p.corePath('cloud/dist.zip'), {
        assetHash: this.node.tryGetContext('originRequestFunctionCodeHash'),
        assetHashType: AssetHashType.CUSTOM,
      }),
    })

    // applying this is a workaround for failing deployments due to the following DELETE_FAILED error:
    // > Resource handler returned message: "Lambda was unable to delete arn:aws:lambda:us-east-1:92330274019:function:stacks-cloud-production-OriginRequestFunction4FA39-XQadJcSWY8Lz:1 because it is a replicated function. Please see our documentation for Deleting Lambda@Edge Functions and Replicas. (Service: Lambda, Status Code: 400, Request ID: 83bd3112-aaa4-4980-bfcf-3ee2052a0435)" (RequestToken: c91aed31-1a62-9425-c25d-4fc0fccfa45f, HandlerErrorCode: InvalidRequest)
    // if we do not delete this resource, then it circumvents trying to delete the function and the deployment succeeds
    // buddy cloud:cleanup is what will be suggested running after user ensured no more sensitive data is in the buckets
    const cfnOriginRequestFunction = originRequestFunction.node.defaultChild as CfnResource
    cfnOriginRequestFunction.applyRemovalPolicy(RemovalPolicy.RETAIN)

    const cdn = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [this.props.domain],
      defaultRootObject: 'index.html',
      comment: `CDN for ${config.app.url}`,
      certificate: this.props.certificate,
      enableLogging: true,
      logBucket: this.props.logBucket,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: this.props.firewall.attrArn,
      enableIpv6: true,

      defaultBehavior: {
        origin: new origins.S3Origin(this.props.storage.publicBucket, {
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
      bucketName: `www.${this.props.domain}`,
      websiteRedirect: {
        hostName: this.props.domain,
        protocol: s3.RedirectProtocol.HTTPS,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create a Route53 record for www.yourdomain.com
    new route53.ARecord(this, 'WwwAliasRecord', {
      recordName: `www.${this.props.domain}`,
      zone: this.props.zone,
      target: route53.RecordTarget.fromAlias(new targets.BucketWebsiteTarget(wwwBucket)),
    })

    this.cdn = cdn
    this.originAccessIdentity = originAccessIdentity
    this.cdnCachePolicy = cdnCachePolicy
    this.vanityUrl = `https://${this.cdn.domainName}`
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

  shouldDeployApi() {
    return config.cloud.deploy?.api
  }

  deployApi() {
    const keysToRemove = ['_HANDLER', '_X_AMZN_TRACE_ID', 'AWS_REGION', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION', 'AWS_LAMBDA_INITIALIZATION_TYPE', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME', 'AWS_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_LAMBDA_RUNTIME_API', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', '_']
    keysToRemove.forEach(key => delete env[key as EnvKey])

    const secrets = new secretsmanager.Secret(this, 'StacksSecrets', {
      secretName: `${this.props.appName}-${this.props.appEnv}-secrets`,
      description: 'Secrets for the Stacks application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify(env),
        generateStringKey: Object.keys(env).join(',').length.toString(),
      },
    })

    const functionName = `${this.props.appName}-${this.props.appEnv}-server`

    // this.apiVanityUrl = api.url
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
        origin: new origins.S3Origin(this.props.storage.publicBucket, {
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
        origin: new origins.S3Origin(this.props.storage.publicBucket, {
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

  shouldDeployDocs() {
    return hasFiles(p.projectPath('docs'))
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

  setApiCachePolicy() {
    if (this.apiCachePolicy)
      return this.apiCachePolicy

    this.apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      comment: 'Stacks API Cache Policy',
      cachePolicyName: `${this.props.appName}-${this.props.appEnv}-api-cache-policy`,
      // minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: Duration.seconds(0),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept', 'x-api-key', 'Authorization'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    })

    return this.apiCachePolicy
  }
}
