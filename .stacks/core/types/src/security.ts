export interface SecurityOptions {
  driver: 'aws'

  appFirewall: {
    immunity: number
    challenge: {
      captcha: {
        duration: number
        headerName: string
        headerValue: string
      }
    }
    rules: {
      name: string
      priority: number
      action: 'allow' | 'block'
      visibilityConfig: {
        sampledRequestsEnabled: boolean
        cloudWatchMetricsEnabled: boolean
        metricName: string
      }
      statement: {
        rateBasedStatement?: {
          limit: number
          aggregateKeyType: 'IP'
        }
        managedRuleGroupStatement?: {
          vendorName: 'AWS'
          name: string
        }
      }
    }[]
  }
}

export type SecurityConfig = SecurityOptions
