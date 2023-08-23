import { app } from '@stacksjs/config'
// import { publicPath } from '@stacksjs/path'
import {
  Duration,
  Fn,
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

export class StacksCloud extends Stack {
  // constructor(scope: Construct, id: string, props?: StackProps) {
  constructor(scope, id, props) {
    super(scope, id, props)

    if (!app.url)
      throw new Error('./config app.url is not defined')

    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: 'stacksjs.com',
    })

    const certificate = new acm.Certificate(this, 'WebsiteCertificate', {
      domainName: 'stacksjs.com',
      hostedZone: zone, // the Route53 hosted zone
      region: 'us-east-1', // CloudFront only accepts certificates in us-east-1,
      validation: acm.CertificateValidation.fromDns(zone), // Use DNS validation
    })

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `stacksjs.com-23123123424324`,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    // Create an S3 bucket for CloudFront access logs
    const logsBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: `stacksjs.com34534545-logs`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    })

    logsBucket.addLifecycleRule({
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
      rules: [
        {
          action: { block: {} },
          name: 'RateLimitRule',
          priority: 0,
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: 2000,
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'rateLimitRuleMetric',
          },
        },
      ],
    })

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI')

    // create a CDN to deploy your website
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames: ['stacksjs.com'],
      defaultRootObject: 'index.html',
      comment: `CDN for ${app.name}`,
      certificate,
      originShieldEnabled: true,
      enableLogging: true,
      logBucket: logsBucket,
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

    // Create a Route53 record pointing to the CloudFront distribution
    // eslint-disable-next-line no-new
    new route53.ARecord(this, 'AliasRecord', {
      recordName: 'stacksjs.com',
      zone,
      // recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    })

    // eslint-disable-next-line no-new
    new route53.CnameRecord(this, 'WwwCnameRecord', {
      zone,
      recordName: 'www',
      domainName: 'stacksjs.com',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    })

    // housekeeping for uploading the data in the bucket

    // eslint-disable-next-line no-new
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('dist')],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // Prints out the web endpoint to the terminal
    // eslint-disable-next-line no-new
    new Output(this, 'AppUrl', {
      value: `https://stacksjs.com`,
      description: 'The URL of the deployed application',
    })

    // Prints out the web endpoint to the terminal
    // eslint-disable-next-line no-new
    new Output(this, 'VanityUrl', {
      value: distribution.domainName,
      description: 'The vanity URL of the deployed application',
    })

    // Output the nameservers of the hosted zone
    // eslint-disable-next-line no-new
    // new Output(this, 'Nameservers', {
    //   value: Fn.join(', ', zone.hostedZoneNameServers),
    //   description: 'Nameservers for the application domain',
    // })
  }
}
