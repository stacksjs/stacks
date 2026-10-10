---
name: stacks-dns
description: Use when managing DNS in a Stacks application - Route53 hosted zones, domain records, nameserver management, or DNS configuration. Covers @stacksjs/dns (AWS Route53 driver), @stacksjs/dnsx, and config/dns.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks DNS

Use the native declarative DNS planner for config reconciliation, and Route53
helpers for hosted-zone/delegation management. Previewing a plan and applying
provider changes are separate operations.

## Declarative additive sync

~~~ts
import { syncDnsConfig } from '@stacksjs/dns'
import { dns, overridesReady } from '@stacksjs/config'

await overridesReady
const preview = await syncDnsConfig('example.com', dns, { dryRun: true })
console.log(preview.plan.create, preview.plan.keep, preview.plan.skip)
~~~

desiredDnsRecords(domain, config) converts native config to provider records.
planDnsSync(desired, current, { zone? }) returns create/keep/skip with reasons.
syncDnsConfig(domain, config, { dryRun?, provider? }) reports created/kept/failed,
failures/skipped/applied/provider. It only creates missing declared records;
it never deletes or overwrites an existing value. Single-value A/AAAA/CNAME
records are kept when present; TXT/MX can add distinct values. Editing config
does not imply changing an already-present provider value.

dryRun reads public DNS without provider credentials; that is not a complete
zone export. Actual apply selects a ts-cloud DNS provider by domain/nameservers
and credentials. A missing provider yields an unapplied plan, not fake success.
The native sync interface supports Route53/Porkbun/GoDaddy/Cloudflare through
the provider factory; retained request/planner tests are not live provider parity.

## Native config record shapes

config/dns.ts uses a/aaaa records with address, cname with target, txt with
content, and mx with mailServer/priority. Each has name and optional ttl.
The older generic value field is not this contract. nameservers describe
delegation and are not included in desired zone records.

Names @/empty mean the apex; names already in the zone or ending in a dot are
absolute. A/AAAA address @ copies an apex address declared in the same config;
without one it is skipped with a reason. CNAME target @ names the apex.
Private/loopback/placeholder addresses and out-of-zone records are skipped;
TTL normalization applies the planner's current minimum. Resolve conflicts
deliberately rather than interpreting keep as identical desired content.

resolveLiveRecords(domain) reads public DNS. renderDnsConfig(domain, records)
renders source for review; dnsProviderForDomain(domain) resolves the mutable
provider. Use buddy dns:* --help for pull/sync command flags and output paths.

## Route53 zone and registrar helpers

The public entry also exports createHostedZone, findHostedZone,
deleteHostedZone/deleteHostedZoneRecords, getNameservers/getHostedZoneNameservers,
updateNameservers, writeNameserversToConfig and addDomain. Their source is
drivers/aws.ts; most zone operations return Result and require inspecting isOk.
Registrar nameservers and hosted-zone delegation are different state. Deleting
a zone or publishing delegation requires the task's authorization.

writeNameserversToConfig changes config/dns.ts. addDomain delegates to the native
application action. Normalization, idempotent zone lookup and provider API errors
are defined by their implementations; use real results instead of assuming
await means a record was published.

## Boundaries and evidence

`@stacksjs/dns` does not currently re-export dnsx: the dependency's missing
runtime entry was intentionally removed from the public graph. Use an installed
working resolver package or native DNS where appropriate, not an import promised
only by ambient declarations. Deploy mail DNS reconciliation has its own owned
record policy in buddy, distinct from this strictly additive planner.

Source: `storage/framework/core/dns/src/index.ts`, sync.ts, drivers/aws.ts,
config/dns.ts and core/types/src/dns.ts. Evidence: core/dns/tests/sync.test.ts
and dns.test.ts. No live DNS mutations are needed to review the planner.
