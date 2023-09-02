export interface SecurityOptions {
  driver: 'aws'

  app: {
    firewall: {
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
        action: { block?: {}; allow?: {} }
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
}

export type SecurityConfig = Partial<SecurityOptions>
