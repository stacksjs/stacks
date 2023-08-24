import { defineSecurity } from '../.stacks/core/config/src/helpers'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineSecurity({
  appFirewall: {
    immunity: 300, // CAPTCHA immunity time 300 seconds
    challenge: {
      captcha: {
        duration: 300,
        headerName: 'x-captcha',
        headerValue: 'true',
      },
    },

    rules: [
      // rule to limit requests to 1000 per 5 minutes
      {
        action: { block: {} },
        name: 'RateLimitRule',
        priority: 0,
        statement: {
          rateBasedStatement: {
            aggregateKeyType: 'IP',
            limit: 1000,
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'rateLimitRuleMetric',
        },
      },

      // use managed rule AWSManagedRulesAmazonIpReputationList
      {
        name: 'AWSManagedRulesAmazonIpReputationList',
        priority: 1,
        // use rule action
        action: { allow: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesAmazonIpReputationList',
        },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesAmazonIpReputationList',
          },
        },
      },

      // use managed rule AWSManagedRulesKnownBadInputsRuleSet
      {
        name: 'AWSManagedRulesKnownBadInputsRuleSet',
        priority: 2,
        // use rule action
        action: { allow: {} },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
        statement: {
          managedRuleGroupStatement: {
            vendorName: 'AWS',
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
      },

      // use managed rule Account takeover prevention
      // {
      //   name: 'AWSManagedRulesAccountTakeoverProtectionRuleSet',
      //   priority: 4,
      //   // use rule action
      //   action: { allow: {} },
      //   visibilityConfig: {
      //     sampledRequestsEnabled: true,
      //     cloudWatchMetricsEnabled: true,
      //     metricName: 'AWSManagedRulesAccountTakeoverProtectionRuleSet',
      //   },
      //   statement: {
      //     managedRuleGroupStatement: {
      //       vendorName: 'AWS',
      //       name: 'AWSManagedRulesAccountTakeoverProtectionRuleSet',
      //     },
      //   },
      // },

      // use managed rule Account creation fraud prevention
      // {
      //   name: 'AWSManagedRulesAdminProtectionRuleSet',
      //   priority: 5,
      //   // use rule action
      //   action: { allow: {} },
      //   visibilityConfig: {
      //     sampledRequestsEnabled: true,
      //     cloudWatchMetricsEnabled: true,
      //     metricName: 'AWSManagedRulesAdminProtectionRuleSet',
      //   },
      //   statement: {
      //     managedRuleGroupStatement: {
      //       vendorName: 'AWS',
      //       name: 'AWSManagedRulesAdminProtectionRuleSet',
      //     },
      //   },
      // },
    ],
  },
})
