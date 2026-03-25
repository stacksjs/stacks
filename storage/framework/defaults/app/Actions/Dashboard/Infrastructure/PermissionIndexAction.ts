import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'

export default new Action({
  name: 'PermissionIndexAction',
  description: 'Returns security and permission configuration from config files.',
  method: 'GET',
  async handle() {
    try {
      const securityConfig = config.security || {}

      // Read firewall settings from config/security.ts
      const firewall = (securityConfig as any).firewall || {}

      const firewallRules = {
        enabled: firewall.enabled ?? false,
        rateLimitPerMinute: firewall.rateLimitPerMinute || 0,
        useIpReputationLists: firewall.useIpReputationLists ?? false,
        useKnownBadInputsRuleSet: firewall.useKnownBadInputsRuleSet ?? false,
      }

      // Read blocked countries
      const blockedCountries = firewall.countryCodes || []

      // Read blocked IP addresses
      const blockedIps = firewall.ipAddresses || []

      // Read blocked query strings
      const blockedQueryStrings = firewall.queryString || []

      // Read blocked HTTP headers
      const blockedHttpHeaders = firewall.httpHeaders || []

      const stats = [
        { label: 'Firewall', value: firewallRules.enabled ? 'Enabled' : 'Disabled' },
        { label: 'Rate Limit', value: `${firewallRules.rateLimitPerMinute}/min` },
        { label: 'Blocked Countries', value: String(blockedCountries.length) },
        { label: 'Blocked IPs', value: String(blockedIps.length) },
      ]

      return {
        firewall: firewallRules,
        blockedCountries,
        blockedIps,
        blockedQueryStrings,
        blockedHttpHeaders,
        stats,
      }
    }
    catch {
      return { firewall: {}, blockedCountries: [], blockedIps: [], stats: [] }
    }
  },
})
