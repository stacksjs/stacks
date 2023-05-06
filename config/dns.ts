import { defineDns } from '@stacksjs/config'

/**
 * **DNS Options**
 *
 * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDns({
  // Should we define AWS Creds here?
  hostedZone: 'stacksjs.dev', // name of the hosted zone
  a: [
    {
      name: 'stacks.dev', // Hostname (root domain)
      address: '10.0.0.1', // IPv4 address
      ttl: 300, // Time-to-live in seconds
    },
    {
      name: 'www', // Subdomain
      address: '192.0.2.2', // IPv4 address
      ttl: 300, // Time-to-live in seconds
    },
  ],

  aaaa: [
    {
      name: 'sampleaaa', // Hostname (root domain)
      address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6 address
      ttl: 300, // Time-to-live in seconds
    },
  ],

  cname: [
    {
      name: 'samplecname', // Alias hostname
      target: '@', // Original hostname (root domain)
      ttl: 300, // Time-to-live in seconds
    },
  ],

  mx: [
    {
      name: 'samplemxhost', // Hostname (root domain)
      mailServer: 'mail.example.com', // Mail server hostname
      ttl: 300, // Time-to-live in seconds
      priority: 10, // Priority (0-65535)
    },
  ],

  txt: [
    {
      name: 'sampletxthost', // Hostname (root domain)
      ttl: 300, // Time-to-live in seconds
      content: 'v=spf1 include:_spf.example.com ~all', // Text content
    },
  ],
})
