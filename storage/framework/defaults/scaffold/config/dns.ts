import type { DnsConfig } from '@stacksjs/types'

/**
 * Additional DNS records owned by this application.
 *
 * Server records are derived from config/cloud.ts during deployment. Add
 * provider and zone details there before asking Buddy to reconcile DNS.
 */
export default {
  a: [],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],
  nameservers: [],
} satisfies DnsConfig
