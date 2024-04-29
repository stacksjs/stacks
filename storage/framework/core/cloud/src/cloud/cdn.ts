import { config } from '@stacksjs/config'
import { env } from '@stacksjs/env'
import { path as p } from '@stacksjs/path'
import { hasFiles } from '@stacksjs/storage'
/* eslint-disable no-new */
import type {
  aws_certificatemanager as acm,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib'
import {
  Duration,
  Fn,
  CfnOutput as Output,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
} from 'aws-cdk-lib'
import type { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import type { Construct } from 'constructs'
import type { EnvKey } from '../../../../env'
import type { NestedCloudProps } from '../types'

export interface CdnStackProps extends NestedCloudProps {
  certificate: acm.Certificate
  logBucket: s3.Bucket
  publicBucket: s3.Bucket
  firewall: wafv2.CfnWebACL
  originRequestFunction: lambda.Function
  zone: route53.IHostedZone
  webServer?: lambda.Function
  webServerUrl?: lambda.FunctionUrl
  cliSetupUrl: lambda.FunctionUrl
  askAiUrl: lambda.FunctionUrl
  summarizeAiUrl: lambda.FunctionUrl
  lb?: ApplicationLoadBalancer
}

export class CdnStack {
  distribution: cloudfront.Distribution
  originAccessIdentity: cloudfront.OriginAccessIdentity
  cdnCachePolicy: cloudfront.CachePolicy
  apiCachePolicy: cloudfront.CachePolicy | undefined
  vanityUrl: string
  realtimeLogConfig: cloudfront.RealtimeLogConfig
  props: CdnStackProps

  constructor(scope: Construct, props: CdnStackProps) {
    this.props = props

    this.originAccessIdentity = new cloudfront.OriginAccessIdentity(
      scope,
      'OAI',
    )

    this.cdnCachePolicy = new cloudfront.CachePolicy(scope, 'CdnCachePolicy', {
      comment: 'Stacks CDN Cache Policy',
      cachePolicyName: `${props.slug}-${props.appEnv}-cdn-cache-policy`,
      minTtl: config.cloud.cdn?.minTtl
        ? Duration.seconds(config.cloud.cdn.minTtl)
        : undefined,
      defaultTtl: config.cloud.cdn?.defaultTtl
        ? Duration.seconds(config.cloud.cdn.defaultTtl)
        : undefined,
      maxTtl: config.cloud.cdn?.maxTtl
        ? Duration.seconds(config.cloud.cdn.maxTtl)
        : undefined,
      cookieBehavior: this.getCookieBehavior(config.cloud.cdn?.cookieBehavior),
    })

    // Step 1: Create a Kinesis Firehose delivery stream for the logs
    const logStream = new kinesis.Stream(scope, 'StacksCdnRealtimeLogStream', {
      streamName: 'StacksCdnRealtimeLogStream',
      retentionPeriod: Duration.days(1),
      shardCount: 1,
      encryption: kinesis.StreamEncryption.UNENCRYPTED,
    })

    // Create an IAM role for CloudFront to write logs to Kinesis Firehose
    // new iam.Role(scope, 'LoggingRole', {
    //   assumedBy: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
    //   inlinePolicies: {
    //     loggingPolicy: new iam.PolicyDocument({
    //       statements: [
    //         new iam.PolicyStatement({
    //           actions: ['kinesis:PutRecord', 'kinesis:PutRecordBatch'],
    //           resources: [logStream.streamArn],
    //         }),
    //       ],
    //     }),
    //   },
    // })

    // TODO: make this configurable
    this.realtimeLogConfig = new cloudfront.RealtimeLogConfig(
      scope,
      'StacksRealTimeLogConfig',
      {
        endPoints: [cloudfront.Endpoint.fromKinesisStream(logStream)],
        fields: [
          'timestamp',
          'c-ip',
          'cs-method',
          'cs-uri-stem',
          'cs-uri-query',
          'cs-referer',
          'cs-user-agent',
          'sc-status',
        ],
        samplingRate: 100, // Adjust the sampling rate as needed
      },
    )

    // the actual CDN distribution
    this.distribution = new cloudfront.Distribution(scope, 'Cdn', {
      domainNames: [props.domain],
      defaultRootObject: 'index.html',
      comment: `CDN for ${config.app.url}`,
      certificate: props.certificate,
      enableLogging: true,
      logBucket: props.logBucket,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: props.firewall.attrArn,
      enableIpv6: true,

      defaultBehavior: {
        origin: new origins.S3Origin(props.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
        }),
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: props.originRequestFunction.currentVersion,
          },
        ],
        compress: config.cloud.cdn?.compress,
        allowedMethods: this.allowedMethods(),
        cachedMethods: this.cachedMethods(),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: this.cdnCachePolicy,
        realtimeLogConfig: this.realtimeLogConfig,
      },

      additionalBehaviors: this.additionalBehaviors(scope, props),

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

    new route53.ARecord(scope, 'AliasRecord', {
      recordName: props.domain,
      zone: props.zone,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(this.distribution),
      ),
    })

    new Output(scope, 'DistributionId', {
      value: this.distribution.distributionId,
    })

    new Output(scope, 'AppUrl', {
      value: `https://${props.domain}`,
      description: 'The URL of the deployed application',
    })

    this.vanityUrl = `https://${this.distribution.domainName}`
    new Output(scope, 'AppVanityUrl', {
      value: this.vanityUrl,
      description: 'The vanity URL of the deployed application',
    })

    // this.originAccessIdentity = originAccessIdentity
    // this.cdnCachePolicy = cdnCachePolicy
  }

  getCookieBehavior(
    behavior: string | undefined,
  ): cloudfront.CacheCookieBehavior | undefined {
    switch (behavior) {
      case 'all':
        return cloudfront.CacheCookieBehavior.all()
      case 'none':
        return cloudfront.CacheCookieBehavior.none()
      case 'allowList':
        // If you have a list of cookies, replace `myCookie` with your cookie
        return cloudfront.CacheCookieBehavior.allowList(
          ...(config.cloud.cdn?.allowList.cookies || []),
        )
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

  allowedMethodsFromString(
    methods?: 'ALL' | 'GET_HEAD' | 'GET_HEAD_OPTIONS',
  ): cloudfront.AllowedMethods {
    if (!methods) return cloudfront.AllowedMethods.ALLOW_ALL

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

  cachedMethodsFromString(
    methods?: 'GET_HEAD' | 'GET_HEAD_OPTIONS',
  ): cloudfront.CachedMethods {
    if (!methods) return cloudfront.CachedMethods.CACHE_GET_HEAD

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
    return config.api?.deploy
  }

  apiBehaviorOptions(
    scope: Construct,
    props: CdnStackProps,
  ): Record<string, cloudfront.BehaviorOptions> {
    const hostname = `api.${props.domain}`

    const origin = () => {
      return new origins.HttpOrigin(hostname, {
        originPath: '/',
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      })
    }

    return {
      '/api': {
        origin: origin(),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: this.setApiCachePolicy(scope),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        realtimeLogConfig: this.realtimeLogConfig,
      },
      '/api/*': {
        origin: origin(),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: this.apiCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        realtimeLogConfig: this.realtimeLogConfig,
      },
    }
  }

  docsBehaviorOptions(
    props: CdnStackProps,
  ): Record<string, cloudfront.BehaviorOptions> {
    return {
      '/docs': {
        origin: new origins.S3Origin(props.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
          originPath: '/docs',
        }),
        compress: true,
        allowedMethods: this.allowedMethodsFromString(
          config.cloud.cdn?.allowedMethods,
        ),
        cachedMethods: this.cachedMethodsFromString(
          config.cloud.cdn?.cachedMethods,
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        realtimeLogConfig: this.realtimeLogConfig,
      },
      '/docs/*': {
        origin: new origins.S3Origin(props.publicBucket, {
          originAccessIdentity: this.originAccessIdentity,
          originPath: '/docs',
        }),
        compress: true,
        allowedMethods: this.allowedMethodsFromString(
          config.cloud.cdn?.allowedMethods,
        ),
        cachedMethods: this.cachedMethodsFromString(
          config.cloud.cdn?.cachedMethods,
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        realtimeLogConfig: this.realtimeLogConfig,
      },
    }
  }

  aiBehaviorOptions(
    scope: Construct,
    props: CdnStackProps,
  ): Record<string, cloudfront.BehaviorOptions> {
    const hostname = Fn.select(2, Fn.split('/', props.askAiUrl.url))
    const summaryHostname = Fn.select(
      2,
      Fn.split('/', props.summarizeAiUrl.url),
    )

    const aiCachePolicy = new cloudfront.CachePolicy(scope, 'AiCachePolicy', {
      comment: 'Stacks AI Cache Policy',
      cachePolicyName: `${this.props.slug}-${this.props.appEnv}-ai-cache-policy`,
      defaultTtl: Duration.seconds(0),
      // minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Accept',
        'x-api-key',
        'Authorization',
        'Content-Type',
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    })

    return {
      '/ai/ask': {
        origin: new origins.HttpOrigin(hostname, {
          originPath: '/ai',
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        compress: false,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: aiCachePolicy,
        realtimeLogConfig: this.realtimeLogConfig,
      },
      '/ai/summary': {
        origin: new origins.HttpOrigin(summaryHostname, {
          originPath: '/ai',
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        compress: false,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: aiCachePolicy,
        realtimeLogConfig: this.realtimeLogConfig,
      },
    }
  }

  cliSetupBehaviorOptions(
    scope: Construct,
    props: CdnStackProps,
  ): Record<string, cloudfront.BehaviorOptions> {
    const hostname = Fn.select(2, Fn.split('/', props.cliSetupUrl.url))

    return {
      '/install': {
        origin: new origins.HttpOrigin(hostname, {
          originPath: '/cli-setup',
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        compress: false,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(scope, 'CliSetupCachePolicy', {
          comment: 'Stacks CLI Setup Cache Policy',
          cachePolicyName: `${this.props.slug}-${this.props.appEnv}-cli-setup-cache-policy`,
          defaultTtl: Duration.seconds(0),
          // minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          headerBehavior: cloudfront.CacheHeaderBehavior.none(),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
        }),
        realtimeLogConfig: this.realtimeLogConfig, // we potentially want to allow for tracking 100% of the traffic here?
      },
    }
  }

  shouldDeployAiEndpoints() {
    return config.cloud.ai
  }

  shouldDeployCliSetup() {
    return config.cloud.cli
  }

  shouldDeployDocs() {
    return hasFiles(p.projectPath('docs'))
  }

  additionalBehaviors(
    scope: Construct,
    props: CdnStackProps,
  ): Record<string, cloudfront.BehaviorOptions> {
    let behaviorOptions: Record<string, cloudfront.BehaviorOptions> = {}

    if (this.shouldDeployApi()) {
      const keysToRemove = [
        '_HANDLER',
        '_X_AMZN_TRACE_ID',
        'AWS_REGION',
        'AWS_EXECUTION_ENV',
        'AWS_LAMBDA_FUNCTION_NAME',
        'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
        'AWS_LAMBDA_FUNCTION_VERSION',
        'AWS_LAMBDA_INITIALIZATION_TYPE',
        'AWS_LAMBDA_LOG_GROUP_NAME',
        'AWS_LAMBDA_LOG_STREAM_NAME',
        'AWS_ACCESS_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_SESSION_TOKEN',
        'AWS_LAMBDA_RUNTIME_API',
        'LAMBDA_TASK_ROOT',
        'LAMBDA_RUNTIME_DIR',
        '_',
      ]
      keysToRemove.forEach((key) => delete env[key as EnvKey])

      behaviorOptions = this.apiBehaviorOptions(scope, props)
    }

    // if docMode is used, we don't need to add a behavior for the docs
    // because the docs will be the root of the site
    if (this.shouldDeployDocs() && !config.app.docMode) {
      behaviorOptions = {
        ...this.docsBehaviorOptions(props),
        ...behaviorOptions,
      }
    }

    if (this.shouldDeployAiEndpoints()) {
      behaviorOptions = {
        ...this.aiBehaviorOptions(scope, props),
        ...behaviorOptions,
      }
    }

    if (this.shouldDeployCliSetup()) {
      behaviorOptions = {
        ...this.cliSetupBehaviorOptions(scope, props),
        ...behaviorOptions,
      }
    }

    return behaviorOptions
  }

  setApiCachePolicy(scope: Construct) {
    if (this.apiCachePolicy) return this.apiCachePolicy

    this.apiCachePolicy = new cloudfront.CachePolicy(scope, 'ApiCachePolicy', {
      comment: 'Stacks API Cache Policy',
      cachePolicyName: `${this.props.slug}-${this.props.appEnv}-api-cache-policy`,
      defaultTtl: Duration.seconds(0),
      // minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Accept',
        'x-api-key',
        'Authorization',
        'Content-Type',
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    })

    return this.apiCachePolicy
  }
}
