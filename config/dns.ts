import { defineDns } from '../.stacks/core/types/src/dns'
import { env } from '../.stacks/core/validation/src'

/**
 * **DNS Options**
 *
 * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDns({
  a: [
    {
      name: env.APP_URL || '', // Hostname (root domain)
      address: '10.0.0.1', // IPv4 address
      ttl: 300, // Time-to-live in seconds
    },

    {
      name: 'www',
      address: '192.0.2.2',
      ttl: 300,
    },

    {
      name: 'docs',
      address: '192.0.2.2',
      ttl: 300,
    },
  ],

  aaaa: [],
  cname: [],
  mx: [],
  txt: [],
})
