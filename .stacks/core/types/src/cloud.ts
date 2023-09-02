export interface CloudOptions {
  driver: 'aws'

  storage: {
    /**
     * Whether or not to also attach a file system to the cloud.
     * This is in addition to the S3 storage. Disable this
     * if you do not need to access the file system.
     *
     * @default true
     * @example
     * ```ts
     * export default {
     *   storage: {
     *     useFileSystem: false
     *   }
     * }
     * ```
     */
    useFileSystem: boolean
  }

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

export type CloudConfig = Partial<CloudOptions>
