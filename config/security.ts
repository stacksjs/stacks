import type { SecurityConfig } from '@stacksjs/types'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  firewall: {
    enabled: true,
    countryCodes: ['RU', 'IR'],
    ipAddresses: [],
    rateLimitPerMinute: 1000,
    useIpReputationLists: true,
    useKnownBadInputsRuleSet: true,
    queryString: [],
    httpHeaders: [],
  },
} satisfies SecurityConfig
