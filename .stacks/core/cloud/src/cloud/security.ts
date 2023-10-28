/* eslint-disable no-new */
// waf and encryption
import { Duration, NestedStack, RemovalPolicy, Tags, aws_kms as kms, aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { NestedCloudProps } from '../types'

export class SecurityStack extends NestedStack {
  constructor(scope: Construct, props: NestedCloudProps) {
    super(scope, 'Security', props)
    const firewallOptions = config.cloud.firewall

    if (!firewallOptions)
      throw new Error('No firewall options found in config')

    const options = {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'firewallMetric',
      },
      rules: this.getFirewallRules(),
    }

    const firewall = new wafv2.CfnWebACL(this, 'WebFirewall', options)
    Tags.of(firewall).add('Name', 'waf-cloudfront', { priority: 300 })
    Tags.of(firewall).add('Purpose', 'CloudFront', { priority: 300 })
    Tags.of(firewall).add('CreatedBy', 'CloudFormation', { priority: 300 })

    new kms.Key(this, 'StacksEncryptionKey', {
      alias: 'stacks-encryption-key',
      description: 'KMS key for Stacks Cloud',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(30),
    })
  }

  getFirewallRules() {
    const rules: wafv2.CfnWebACL.RuleProperty[] = []
    const priorities = []

    if (config.security.firewall?.countryCodes?.length) {
      priorities.push(1)
      rules.push({
        name: 'CountryRule',
        priority: priorities.length,
        statement: {
          geoMatchStatement: {
            countryCodes: config.security.firewall.countryCodes,
          },
        },
        action: {
          block: {},
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'CountryRule',
        },
      })
    }

    if (config.security.firewall?.ipAddresses?.length) {
      const ipSet = new wafv2.CfnIPSet(this, 'IpSet', {
        name: 'IpSet',
        description: 'IP Set',
        scope: 'CLOUDFRONT',
        addresses: config.security.firewall.ipAddresses,
        ipAddressVersion: 'IPV4',
      })

      priorities.push(1)
      rules.push({
        name: 'IpAddressRule',
        priority: priorities.length,
        statement: {
          ipSetReferenceStatement: {
            arn: ipSet.attrArn,
          },
        },
        action: {
          block: {},
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'IpAddressRule',
        },
      })
    }

    if (config.security.firewall?.httpHeaders?.length) {
      config.security.firewall.httpHeaders.forEach((header, index) => {
        priorities.push(1)
        rules.push({
          name: `HttpHeaderRule${index}`,
          priority: priorities.length,
          statement: {
            byteMatchStatement: {
              fieldToMatch: {
                singleHeader: {
                  name: header,
                },
              },
              positionalConstraint: 'EXACTLY',
              searchString: 'true',
              textTransformations: [
                {
                  priority: index,
                  type: 'NONE',
                },
              ],
            },
          },
          action: {
            block: {},
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `HttpHeaderRule${index}`,
          },
        })
      })
    }

    // if (config.security.firewall?.queryString?.length) {
    //   priorities.push(1)
    //   rules.push({
    //     name: 'QueryStringRule',
    //     priority: priorities.length,
    //     statement: {
    //       byteMatchStatement: {
    //         fieldToMatch: {
    //           queryString: {},
    //         },
    //         positionalConstraint: 'EXACTLY',
    //         searchString: config.security.firewall.queryString.join(', '),
    //         textTransformations: [
    //           {
    //             priority: 0,
    //             type: 'NONE',
    //           },
    //         ],
    //       },
    //     },
    //     action: {
    //       block: {},
    //     },
    //     visibilityConfig: {
    //       sampledRequestsEnabled: true,
    //       cloudWatchMetricsEnabled: true,
    //       metricName: 'QueryStringRule',
    //     },
    //   })
    // }

    // if (config.security.firewall?.rateLimitPerMinute) {
    //   priorities.push(1)
    //   rules.push({
    //     name: 'RateLimitRule',
    //     priority: priorities.length,
    //     statement: {
    //       rateBasedStatement: {
    //         limit: config.security.firewall.rateLimitPerMinute,
    //         aggregateKeyType: 'IP',
    //       },
    //     },
    //     action: {
    //       block: {},
    //     },
    //     visibilityConfig: {
    //       sampledRequestsEnabled: true,
    //       cloudWatchMetricsEnabled: true,
    //       metricName: 'RateLimitRule',
    //     },
    //   })
    // }

    // if (config.security.firewall?.useIpReputationLists) {
    //   priorities.push(1)
    //   rules.push({
    //     name: 'IpReputationRule',
    //     priority: priorities.length,
    //     statement: {
    //       managedRuleGroupStatement: {
    //         vendorName: 'AWS',
    //         name: 'AWSManagedRulesAmazonIpReputationList',
    //       },
    //     },
    //     action: {
    //       block: {},
    //     },
    //     visibilityConfig: {
    //       sampledRequestsEnabled: true,
    //       cloudWatchMetricsEnabled: true,
    //       metricName: 'IpReputationRule',
    //     },
    //   })
    // }

    // if (config.security.firewall?.useKnownBadInputsRuleSet) {
    //   priorities.push(1)
    //   rules.push({
    //     name: 'KnownBadInputsRule',
    //     priority: priorities.length,
    //     statement: {
    //       managedRuleGroupStatement: {
    //         vendorName: 'AWS',
    //         name: 'AWSManagedRulesKnownBadInputsRuleSet',
    //       },
    //     },
    //     action: {
    //       block: {},
    //     },
    //     visibilityConfig: {
    //       sampledRequestsEnabled: true,
    //       cloudWatchMetricsEnabled: true,
    //       metricName: 'KnownBadInputsRule',
    //     },
    //   })
    // }
    // also add
    //     }, {
    //   "name": "AWSManagedRulesAnonymousIpList",
    //   "priority": 40,
    //   "overrideAction": "none",
    //   "excludedRules": []
    // }, {
    //   "name": "AWSManagedRulesLinuxRuleSet",
    //   "priority": 50,
    //   "overrideAction": "none",
    //   "excludedRules": []
    // }, {
    //   "name": "AWSManagedRulesUnixRuleSet",
    //   "priority": 60,
    //   "overrideAction": "none",
    //   "excludedRules": [],
    // }];

    return rules
  }
}
