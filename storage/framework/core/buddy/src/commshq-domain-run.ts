/**
 * `setUpSendingDomain` wired to this project: its configuration says which
 * domain mail should come from, and its own DNS provider publishes the
 * records. The logic, and its tests, are in `./commshq-domain`.
 */

import type { PublishResult, SendingDomainOutcome, SendingDomainRecord } from './commshq-domain'
import { sendingDomainFor, setUpSendingDomain } from './commshq-domain'

export interface SendingDomainRun {
  /** CommsHQ's origin. */
  url: string
  /** The app's send key. */
  key: string
  /** The From address the app sends with, where it has one. */
  mailFrom?: string
  /** Where the app is served. */
  appUrl?: string
  /** The zone the project declares (`infrastructure.dns.domain`), where it differs from the sending domain. */
  zone?: string
  print: (line: string) => void
}

/** The zone a name's records live in: the declared one when the name is inside it, else the name itself. */
export function zoneFor(domain: string, declared?: string): string {
  const zone = String(declared || '').trim().toLowerCase().replace(/\.$/, '')
  return zone && (domain === zone || domain.endsWith(`.${zone}`)) ? zone : domain
}

/** Publish through the framework's additive DNS sync: creates what is missing, changes and removes nothing. */
async function publish(zone: string, records: SendingDomainRecord[]): Promise<PublishResult> {
  const { syncDnsConfig } = await import('@stacksjs/dns')
  const result = await syncDnsConfig(zone, {
    a: [],
    aaaa: [],
    cname: [],
    mx: [],
    nameservers: [],
    txt: records.map(record => ({ name: `${record.name}.`, content: record.content, ttl: 300 })),
  } as any)
  return {
    provider: result.provider,
    created: result.created,
    kept: result.kept,
    failures: [
      ...result.failures.map(failure => ({ name: failure.record.name, reason: failure.reason })),
      ...result.skipped.map(skipped => ({ name: skipped.record.name, reason: skipped.reason })),
    ],
  }
}

/** Set up the sending domain of this project, or say why there is nothing to set up. */
export async function setUpSendingDomainForApp(run: SendingDomainRun): Promise<SendingDomainOutcome> {
  const domain = sendingDomainFor({ mailFrom: run.mailFrom, appUrl: run.appUrl })
  if (!domain) {
    run.print('  No sending domain: set APP_URL or MAIL_FROM_ADDRESS to the address mail should come from. Until then mail goes out from a CommsHQ address.')
    return { status: 'skipped', detail: 'the app has no public domain configured' }
  }

  return setUpSendingDomain({ url: run.url, key: run.key, domain, zone: zoneFor(domain, run.zone) }, {
    fetch: (input, init) => fetch(input, init),
    publish,
    print: run.print,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  })
}
