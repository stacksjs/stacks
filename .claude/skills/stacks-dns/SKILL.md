---
name: stacks-dns
description: Use when managing DNS in a Stacks application — Route53 hosted zones, domain records, nameserver management, or DNS configuration. Covers @stacksjs/dns (AWS Route53 driver), @stacksjs/dnsx, and config/dns.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks DNS

## Key Paths
- Core package: `storage/framework/core/dns/src/`
- AWS driver: `storage/framework/core/dns/src/drivers/aws.ts`
- Config: `config/dns.ts`
- Package: `@stacksjs/dns`

## Source Files
```
dns/src/
├── index.ts              # Re-exports from drivers and @stacksjs/dnsx
└── drivers/
    └── aws.ts            # AWS Route53 DNS management
```

## AWS Route53 API

```typescript
import {
  createHostedZone,
  deleteHostedZone,
  deleteHostedZoneRecords,
  getNameservers,
  getHostedZoneNameservers,
  updateNameservers,
  findHostedZone,
  hasUserDomainBeenAddedToCloud,
  writeNameserversToConfig,
  addDomain,
} from '@stacksjs/dns'
```

### Hosted Zone Management

```typescript
// Create or retrieve a hosted zone
createHostedZone(domainName: string): Promise<Result<HostedZone | CreateHostedZoneResult | string | null, Error>>

// Delete a zone and all its records
deleteHostedZone(domainName: string): Promise<Result<string, Error>>

// Delete records only, keep zone
deleteHostedZoneRecords(domainName: string): Promise<Result<string, Error>>

// Find a zone by domain name
findHostedZone(domain: string): Promise<Result<string | null | undefined, Error>>

// Check if domain is in cloud
hasUserDomainBeenAddedToCloud(domainName?: string): Promise<boolean>
```

### Nameserver Management

```typescript
// Get nameservers from Route53 Domains
getNameservers(domainName?: string): Promise<string[] | undefined>

// Get nameservers from hosted zone delegation set
getHostedZoneNameservers(domainName: string): Promise<string[]>

// Update domain nameservers in Route53
updateNameservers(hostedZoneNameservers: string[], domainName?: string): Promise<boolean | undefined>

// Persist nameservers to config/dns.ts
writeNameserversToConfig(nameservers: string[]): void
```

### Domain Actions

```typescript
// Run domain add action (delegates to CLI action)
addDomain(options: DeployOptions): Promise<Result<Subprocess, CommandError>>
```

### Helpers

```typescript
// Internal helpers
deleteRecordsForZone(zoneId: string): Promise<void>
normalizeDomain(domain: string): string
sanitizeNameserver(ns: string): string
```

## Configuration (config/dns.ts)

```typescript
import { defineDns } from '@stacksjs/config'

export default defineDns({
  a: [{ name: 'example.com', value: '1.2.3.4', ttl: 300 }],
  aaaa: [],
  cname: [],
  mx: [],
  txt: [],
  nameservers: [
    'ns-1731.awsdns-24.co.uk',
    'ns-355.awsdns-44.com',
    'ns-536.awsdns-03.net',
    'ns-1395.awsdns-46.org',
  ],
  redirects: [],
})
```

### DnsConfig Interface

```typescript
interface DnsConfig {
  a: Array<{ name: string, value: string, ttl?: number }>
  aaaa: Array<{ name: string, value: string, ttl?: number }>
  cname: Array<{ name: string, value: string, ttl?: number }>
  mx: Array<{ name: string, value: string, ttl?: number, priority?: number }>
  txt: Array<{ name: string, value: string, ttl?: number }>
  nameservers: string[]
  redirects?: Array<{ from: string, to: string }>
}
```

## CLI Commands

```bash
buddy dns                # DNS management
buddy domains            # Domain management
buddy domains:add        # Add a domain to cloud
buddy domains:remove     # Remove a domain
buddy domains:purchase   # Purchase a domain
```

## Re-exports from @stacksjs/dnsx

Additional DNS utilities (lookups, resolution) are re-exported from the `@stacksjs/dnsx` package.

## Gotchas
- **AWS-only** — currently only supports AWS Route53 as the DNS provider
- **Uses ts-cloud SDK** — Route53 API calls go through the ts-cloud abstraction
- **Result type** — most functions return `Result<T, Error>` from `ts-error-handling`, not plain values
- **`writeNameserversToConfig` mutates config/dns.ts** — directly writes to the config file
- **Domain name normalization** — trailing dots and www prefixes are handled automatically
- **`createHostedZone` is idempotent** — returns existing zone if it already exists
- **Nameservers must be synced** — hosted zone nameservers must match domain registrar nameservers for DNS to work
