import type { aws_certificatemanager as acm, aws_s3 as s3, aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import type { ApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'
import { config } from '@stacksjs/config'
import {
  aws_cloudfront as cloudfront,
  Duration,
  aws_lambda as lambda,
  aws_cloudfront_origins as origins,
  CfnOutput as Output,
  aws_route53 as route53,
  aws_route53_targets as targets,
} from 'aws-cdk-lib'

export interface CdnStackProps extends NestedCloudProps {
  certificate: acm.Certificate
  logBucket: s3.Bucket
  publicBucket: s3.Bucket
  docsBucket?: s3.Bucket
  firewall: wafv2.CfnWebACL
  originRequestFunction: lambda.Function
  zone: route53.IHostedZone
  webServer?: lambda.Function
  webServerUrl?: lambda.FunctionUrl
  lb?: ApplicationLoadBalancer
}

export class CdnStack {
  mainDistribution: cloudfront.Distribution
  docsDistribution: cloudfront.Distribution | undefined
  cdnCachePolicy: cloudfront.CachePolicy
  mainVanityUrl!: string
  docsVanityUrl: string | undefined
  realtimeLogConfig!: cloudfront.RealtimeLogConfig
  props: CdnStackProps

  constructor(scope: Construct, props: CdnStackProps) {
    this.props = props

    this.cdnCachePolicy = new cloudfront.CachePolicy(scope, 'CdnCachePolicy', {
      comment: 'Stacks CDN Cache Policy',
      cachePolicyName: `${props.slug}-${props.appEnv}-cdn-cache-policy`,
      minTtl: config.cloud.cdn?.minTtl ? Duration.seconds(config.cloud.cdn.minTtl) : undefined,
      defaultTtl: config.cloud.cdn?.defaultTtl ? Duration.seconds(config.cloud.cdn.defaultTtl) : undefined,
      maxTtl: config.cloud.cdn?.maxTtl ? Duration.seconds(config.cloud.cdn.maxTtl) : undefined,
      cookieBehavior: this.getCookieBehavior(config.cloud.cdn?.cookieBehavior),
    })

    const originAccessControl = new cloudfront.S3OriginAccessControl(scope, 'WebOAC', {
      originAccessControlName: `${props.slug}-${props.appEnv}-web-oac-${props.timestamp}`,
      description: 'Access from CloudFront to the frontend bucket.',
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    })

    if (config.app.docMode) {
      // In doc mode, create only one distribution for docs
      this.mainDistribution = this.createDistribution(
        scope,
        props,
        props.docsBucket as s3.Bucket,
        this.createDocsOriginRequestFunction(scope),
        props.domain,
        'MainCdn',
        originAccessControl,
      )
    }
    else {
      // Not in doc mode, create two distributions
      this.mainDistribution = this.createDistribution(
        scope,
        props,
        props.publicBucket,
        props.originRequestFunction,
        props.domain,
        'MainCdn',
        originAccessControl,
      )

      if (props.docsBucket) {
        this.docsDistribution = this.createDistribution(
          scope,
          props,
          props.docsBucket,
          this.createDocsOriginRequestFunction(scope),
          `docs.${props.domain}`,
          'DocsCdn',
          originAccessControl,
        )
      }
    }

    // Create Route53 records
    this.createRoute53Records(scope, props)

    // Create outputs
    this.createOutputs(scope, props)
  }

  createDistribution(
    scope: Construct,
    props: CdnStackProps,
    sourceBucket: s3.Bucket,
    originRequestFunction: lambda.Function,
    domainName: string,
    id: string,
    originAccessControl: cloudfront.S3OriginAccessControl,
  ): cloudfront.Distribution {
    return new cloudfront.Distribution(scope, id, {
      domainNames: [domainName],
      defaultRootObject: 'index.html',
      comment: `CDN for ${domainName}`,
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
        origin: new origins.S3StaticWebsiteOrigin(sourceBucket, {
          originPath: '/',
          originAccessControlId: originAccessControl.originAccessControlId,
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
      errorResponses: [
        {
          httpStatus: 404,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
          ttl: Duration.millis(0),
        },
        {
          httpStatus: 403,
          responsePagePath: '/index.html',
          responseHttpStatus: 200,
          ttl: Duration.millis(0),
        },
      ],
    })
  }

  createRoute53Records(scope: Construct, props: CdnStackProps): void {
    new route53.ARecord(scope, 'MainAliasRecord', {
      recordName: props.domain,
      zone: props.zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.mainDistribution)),
    })

    if (this.docsDistribution) {
      new route53.ARecord(scope, 'DocsAliasRecord', {
        recordName: `docs.${props.domain}`,
        zone: props.zone,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.docsDistribution)),
      })
    }
  }

  createOutputs(scope: Construct, props: CdnStackProps): void {
    new Output(scope, 'MainDistributionId', {
      value: this.mainDistribution.distributionId,
    })

    new Output(scope, 'MainUrl', {
      value: `https://${props.domain}`,
      description: 'The URL of the deployed main application',
    })

    this.mainVanityUrl = `https://${this.mainDistribution.domainName}`
    new Output(scope, 'MainVanityUrl', {
      value: this.mainVanityUrl,
      description: 'The vanity URL of the deployed main application',
    })

    if (this.docsDistribution) {
      new Output(scope, 'DocsDistributionId', {
        value: this.docsDistribution.distributionId,
      })

      this.docsVanityUrl = `https://${this.docsDistribution.domainName}`
      new Output(scope, 'DocsAppVanityUrl', {
        value: this.docsVanityUrl,
        description: 'The vanity URL of the deployed docs application',
      })
    }
  }

  createDocsOriginRequestFunction(scope: Construct): lambda.Function {
    const docsOriginRequestFunction = new lambda.Function(scope, 'DocsOriginRequestFunction', {
      functionName: `${this.props.slug}-${this.props.appEnv}-docs-origin-request-function-${this.props.timestamp}`,
      description: 'Custom origin request function for the docs',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const config = {
          suffix: '.html',
        }

        const regexSuffixless = /\\/[^/.]+$/
        const regexTrailingSlash = /.+\\/$/

        exports.handler = (event, context, callback) => {
          const request = event.Records[0].cf.request;
          const uri = request.uri;

          // Append index.html to root URI
          if (uri === '/') {
            request.uri = '/index.html';
            callback(null, request);
            return;
          }

          // Append .html to suffixless URI
          if (uri.match(regexSuffixless)) {
            request.uri = uri + '.html';
            callback(null, request);
            return;
          }

          // Remove trailing slash and append .html to origin request
          if (uri.match(regexTrailingSlash)) {
            request.uri = uri.slice(0, -1) + '.html';
            callback(null, request);
            return;
          }

          callback(null, request);
        };
      `),
    })

    new lambda.CfnPermission(scope, 'DocsOriginRequestFunctionPermission', {
      action: 'lambda:InvokeFunction',
      principal: 'edgelambda.amazonaws.com',
      functionName: docsOriginRequestFunction.functionName,
    })

    return docsOriginRequestFunction
  }

  getCookieBehavior(cookieBehavior: string | undefined): cloudfront.CacheCookieBehavior | undefined {
    switch (cookieBehavior) {
      case 'none':
        return cloudfront.CacheCookieBehavior.none()
      case 'all':
        return cloudfront.CacheCookieBehavior.all()
      case 'allowList':
        return cloudfront.CacheCookieBehavior.allowList(...(config.cloud.cdn?.allowList.cookies || []))
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
}
