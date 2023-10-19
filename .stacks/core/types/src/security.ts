import type { aws_wafv2 as wafv2 } from 'aws-cdk-lib'
import type { CountryCode } from './cloud'

export type FirewallOptions = wafv2.CfnWebACLProps & {
  enabled: boolean // default: true
  countryCodes: CountryCode[]
  ipAddresses: string[]
  queryString: string[]
  httpHeaders: string[]
  ipSets: string[]
  rateLimitPerMinute: number
  useIpReputationLists: boolean
  useKnownBadInputsRuleSet: boolean
}
export type FirewallConfig = Partial<FirewallOptions>

export interface SecurityOptions {
  driver: 'aws'

  firewall: FirewallOptions
}

export type SecurityConfig = Partial<SecurityOptions>
