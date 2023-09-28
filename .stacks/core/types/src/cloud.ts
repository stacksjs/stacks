export interface CloudOptions {
  driver: 'aws'

  // eslint-disable-next-line @typescript-eslint/ban-types
  storage: {}

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
      // eslint-disable-next-line @typescript-eslint/ban-types
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

  cdn: {
    enableLogging: boolean
    allowedMethods: 'GET_HEAD' | 'GET_HEAD_OPTIONS' | 'ALL'
    cachedMethods: 'GET_HEAD' | 'GET_HEAD_OPTIONS'
    minTtl: number
    defaultTtl: number
    maxTtl: number
    compress: boolean
    priceClass: 'PriceClass_100' | 'PriceClass_200' | 'PriceClass_All'
    originShieldRegion: string
    cookieBehavior: 'none' | 'allowList' | 'all'
    allowList: {
      cookies: string[]
      headers: string[]
      queryStrings: string[]
    }
  }

  deploy: {
    docs: boolean
    api: boolean
    fileSystem: boolean
  }
}

export type CloudConfig = Partial<CloudOptions>
