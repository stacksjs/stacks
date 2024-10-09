import type { DnsConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **DNS Options**
 *
 * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  a: [
    {
      name: env.APP_URL || '', // Hostname (root domain)
      address: '10.0.0.1', // IPv4 address
      ttl: 300, // Time-to-live in seconds
    },

    {
      name: 'www',
      address: '@',
      ttl: 300,
    },
  ],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],

  nameservers: [],

  // redirects: ['stacksjs.com', 'buddy.sh'],
} satisfies DnsConfig
