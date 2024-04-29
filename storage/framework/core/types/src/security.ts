import type { CountryCode } from './cloud'
import type { DeepPartial } from './utils'

export interface FirewallOptions {
  enabled: boolean // default: true
  countryCodes: CountryCode[]
  ipAddresses: string[]
  queryString: string[]
  httpHeaders: string[]
  // ipSets: string[]
  rateLimitPerMinute: number
  useIpReputationLists: boolean
  useKnownBadInputsRuleSet: boolean
}
export type FirewallConfig = Partial<FirewallOptions>

export interface SecurityOptions {
  driver: 'aws'

  firewall: FirewallOptions
}

export type SecurityConfig = DeepPartial<SecurityOptions>
