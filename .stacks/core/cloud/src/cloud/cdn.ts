/* eslint-disable no-new */
import type { CfnResource, aws_certificatemanager as acm, aws_lambda as lambda, aws_route53 as route53, aws_s3 as s3, aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import {
  AssetHashType,
  Duration,
  CfnOutput as Output,
  RemovalPolicy,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_secretsmanager as secretsmanager,
  aws_ssm as ssm,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { config } from '@stacksjs/config'
import { hasFiles } from '@stacksjs/storage'
import { path as p } from '@stacksjs/path'
import type { NestedCloudProps } from '../types'
import type { EnvKey } from '~/storage/framework/stacks/env'

export interface CdnStackProps extends NestedCloudProps {
  certificate: acm.Certificate
  logBucket: s3.Bucket
  publicBucket: s3.Bucket
  zone: route53.IHostedZone
  firewall: wafv2.CfnWebACL
  originRequestFunction: lambda.Function
}

// export class CdnStack extends NestedStack {
export class CdnStack {
  distribution: cloudfront.Distribution
  originAccessIdentity: cloudfront.OriginAccessIdentity
  cdnCachePolicy: cloudfront.CachePolicy
  apiCachePolicy: cloudfront.CachePolicy | undefined
  vanityUrl: string
  props: CdnStackProps

  constructor(scope: Construct, props: CdnStackProps) {
    this.props = props

    // proceed with cdn logic
    this.originAccessIdentity = new cloudfront.OriginAccessIdentity(scope, 'OAI')

    this.cdnCachePolicy = new cloudfront.CachePolicy(scope, 'CdnCachePolicy', {
      comment: 'Stacks CDN Cache Policy',
      cachePolicyName: `${props.appName}-${props.appEnv}-cdn-cache-policy`,
      minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: config.cloud.cdn?.defaultTtl ? Duration.seconds(config.cloud.cdn.defaultTtl) : undefined,
      maxTtl: config.cloud.cdn?.maxTtl ? Duration.seconds(config.cloud.cdn.maxTtl) : undefined,
      cookieBehavior: this.getCookieBehavior(config.cloud.cdn?.cookieBehavior),
    })

    // Fetch the timestamp from SSM Parameter Store
    // const timestampParam = ssm.StringParameter.fromSecureStringParameterAttributes(scope, 'TimestampParam', {
    //   parameterName: `/stacks/${props.appName.toLowerCase()}/timestamp`,
    //   version: 1,
    // })

    // let timestamp = timestampParam.stringValue

    // // If the timestamp does not exist, create it
    // if (!timestamp) {
    //   timestamp = new Date().getTime().toString()
    //   new ssm.StringParameter(scope, 'TimestampParam', {
    //     parameterName: `/stacks/${props.appName.toLowerCase()}/timestamp`,
    //     stringValue: timestamp,
    //   })
    // }

    // the actual CDN distribution
    this.distribution = new cloudfront.Distribution(scope, 'Distribution', {
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

  // apiBehaviorOptions(): Record<string, cloudfront.BehaviorOptions> {
  // const origin = (path: '/api' | '/api/*' = '/api') => new origins.HttpOrigin(Fn.select(2, Fn.split('/', this.apiVanityUrl)), { // removes the https://
  //   originPath: path,
  //   protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
  // })

  // return {
  //   '/api': {
  //     origin: origin(),
  //     compress: true,
  //     allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
  //     // cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
  //     cachePolicy: this.setApiCachePolicy(),
  //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  //   },
  //   '/api/*': {
  //     origin: origin('/api/*'),
  //     compress: true,
  //     allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
  //     // cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
  //     cachePolicy: this.apiCachePolicy,
  //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  //   },
  // }
  // }

  docsBehaviorOptions(props: CdnStackProps): Record<string, cloudfront.BehaviorOptions> {
    return {
      '/docs': {
        origin: new origins.S3Origin(props.publicBucket, {
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
        origin: new origins.S3Origin(props.publicBucket, {
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

  additionalBehaviors(scope: Construct, props: CdnStackProps): Record<string, cloudfront.BehaviorOptions> {
    let behaviorOptions: Record<string, cloudfront.BehaviorOptions> = {}

    if (this.shouldDeployApi()) {
      const keysToRemove = ['_HANDLER', '_X_AMZN_TRACE_ID', 'AWS_REGION', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION', 'AWS_LAMBDA_INITIALIZATION_TYPE', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME', 'AWS_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_LAMBDA_RUNTIME_API', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', '_']
      keysToRemove.forEach(key => delete env[key as EnvKey])

      new secretsmanager.Secret(scope, 'StacksSecrets', {
        secretName: `${props.appName}-${props.appEnv}-secrets`,
        description: 'Secrets for the Stacks application',
        generateSecretString: {
          secretStringTemplate: JSON.stringify(env),
          generateStringKey: Object.keys(env).join(',').length.toString(),
        },
      })

      // behaviorOptions = this.apiBehaviorOptions()
    }

    // if docMode is used, we don't need to add a behavior for the docs
    // because the docs will be the root of the site
    if (this.shouldDeployDocs() && !config.app.docMode) {
      behaviorOptions = {
        ...this.docsBehaviorOptions(props),
        ...behaviorOptions,
      }
    }

    return behaviorOptions
  }

  setApiCachePolicy(scope: Construct) {
    if (this.apiCachePolicy)
      return this.apiCachePolicy

    this.apiCachePolicy = new cloudfront.CachePolicy(scope, 'ApiCachePolicy', {
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
