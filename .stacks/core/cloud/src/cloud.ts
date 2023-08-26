import type { Construct } from 'constructs'
import type { StackProps } from 'aws-cdk-lib'
import {
  Duration,
  CfnOutput as Output,
  RemovalPolicy,
  Stack,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_route53_targets as targets,
  aws_wafv2 as wafv2,
} from 'aws-cdk-lib'
import { app } from '../../config/src'

// import { publicPath } from '@stacksjs/path'

export class StacksCloud extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    if (!app.url)
      throw new Error('./config app.url is not defined')

    const domainName = app.url

    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName,
    })

    const certificate = new acm.Certificate(this, 'WebsiteCertificate', {
      domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    })

    const docsCertificate = new acm.Certificate(this, 'DocsCertificate', {
      domainName: `${app.subdomains.docs}.${domainName}`,
      validation: acm.CertificateValidation.fromDns(zone),
    })

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `${domainName}-${app.env}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const docsBucket = new s3.Bucket(this, 'DocsBucket', {
      bucketName: `docs.${domainName}-${app.env}`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create an S3 bucket for CloudFront access logs
    const logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: `${domainName}-logs-${app.env}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })

    logBucket.addLifecycleRule({
      enabled: true,
      expiration: Duration.days(30),
      id: 'rule',
    })

    // Create WAF WebAcl
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} }, // Default action is to allow requests
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'webAclMetric',
      },
      // rules: security.appFirewall?.rules,
    })

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI')

    // create a CDN to deploy your website
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: [domainName],
      defaultRootObject: 'index.html',
      comment: `CDN for ${app.url}`,
      certificate,
      // originShieldEnabled: true,
      enableLogging: true,
      logBucket,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: webAcl.attrArn,
      enableIpv6: true,

      defaultBehavior: {
        origin: new origins.S3Origin(webBucket, {
          originAccessIdentity,
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // errorResponses: [
      //   {
      //     httpStatus: 403,
      //     responsePagePath: '/index.html',
      //     responseHttpStatus: 200,
      //     ttl: cdk.Duration.minutes(0),
      //   },
      //   {
      //     httpStatus: 404,
      //     responsePagePath: '/index.html',
      //     responseHttpStatus: 200,
      //     ttl: cdk.Duration.minutes(0),
      //   },
      // ],
    })

    const docsDistribution = new cloudfront.Distribution(this, 'DocsDistribution', {
      domainNames: [`${app.subdomains.docs}.${app.url}`],
      defaultRootObject: 'index.html',
      comment: `CDN for ${app.subdomains.docs}.${app.url}`,
      certificate: docsCertificate,
      // originShieldEnabled: true,
      enableLogging: true,
      logBucket,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: webAcl.attrArn,
      enableIpv6: true,

      defaultBehavior: {
        origin: new origins.S3Origin(docsBucket, {
          originAccessIdentity,
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },

      // errorResponses: [
      //   {
      //     httpStatus: 403,
      //     responsePagePath: '/index.html',
      //     responseHttpStatus: 200,
      //     ttl: cdk.Duration.minutes(0),
      //   },
      //   {
      //     httpStatus: 404,
      //     responsePagePath: '/index.html',
      //     responseHttpStatus: 200,
      //     ttl: cdk.Duration.minutes(0),
      //   },
      // ],
    })

    // Create a Route53 record pointing to the CloudFront distribution
    // eslint-disable-next-line no-new
    new route53.ARecord(this, 'AliasRecord', {
      recordName: domainName,
      zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    })

    // Create a Route53 record pointing to the Docs CloudFront distribution
    // eslint-disable-next-line no-new
    new route53.ARecord(this, 'DocsAliasRecord', {
      recordName: `${app.subdomains.docs}.${domainName}`,
      zone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    })

    // eslint-disable-next-line no-new
    new route53.CnameRecord(this, 'WwwCnameRecord', {
      zone,
      recordName: 'www',
      domainName,
    })

    // eslint-disable-next-line no-new
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../../../storage/public')],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // eslint-disable-next-line no-new
    new s3deploy.BucketDeployment(this, 'DeployDocs', {
      sources: [s3deploy.Source.asset('../../../storage/app/docs')],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // Prints out the web endpoint to the terminal
    // eslint-disable-next-line no-new
    new Output(this, 'AppUrl', {
      value: `https://${domainName}`,
      description: 'The URL of the deployed application',
    })

    // Prints out the web endpoint to the terminal
    // eslint-disable-next-line no-new
    new Output(this, 'DocsUrl', {
      value: `https://${app.subdomains.docs}.${app.url}`,
      description: 'The URL of the deployed documentation',
    })

    // Prints out the web endpoint to the terminal
    // eslint-disable-next-line no-new
    new Output(this, 'VanityUrl', {
      value: `https://${distribution.domainName}`,
      description: 'The vanity URL of the deployed application',
    })

    // Output the nameservers of the hosted zone
    // new Output(this, 'Nameservers', {
    //   value: Fn.join(', ', zone.hostedZoneNameServers),
    //   description: 'Nameservers for the application domain',
    // })
  }
}
