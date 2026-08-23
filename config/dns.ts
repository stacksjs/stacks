import type { DnsConfig } from '@stacksjs/types'

/**
 * **DNS Options**
 *
 * Extra records this application owns, beyond the ones the deploy derives from
 * `config/cloud.ts` (apex, www, dashboard, mail, TLS challenge). `buddy deploy`
 * reconciles these additively: it creates a declared record that is missing and
 * never deletes or overwrites one that exists.
 *
 * Names are relative to the zone, with `@` for the apex. `address: '@'` on an
 * A or AAAA record copies the apex address declared here, which means it needs
 * an apex record to copy - there is no apex entry below because the deploy
 * publishes the box address itself from `config/cloud.ts`.
 *
 * This file used to carry the scaffold sample (`10.0.0.1` under a name of
 * `env.APP_DOMAIN`, plus `www` pointing at `'@'`). Every deploy tried to
 * publish it: the placeholder address was dropped as private, and the `'@'`
 * went to the registrar verbatim as an A record address, which Cloudflare
 * rejected once per zone that lacked a `www` record.
 */
export default {
  a: [],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],

  // Authoritative nameservers for stacksjs.com. Delegation, not zone records:
  // nothing publishes these, the dashboard reads them to show where the zone
  // lives. They named AWS long after the zone moved to Cloudflare.
  nameservers: ['alex.ns.cloudflare.com', 'melany.ns.cloudflare.com'],
} satisfies DnsConfig
