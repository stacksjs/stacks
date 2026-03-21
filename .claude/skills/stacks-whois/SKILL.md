---
name: stacks-whois
description: Use when performing WHOIS lookups in a Stacks application — domain ownership queries, registration info, or DNS record lookups. Covers the @stacksjs/whois package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks WHOIS

The `@stacksjs/whois` package provides WHOIS lookup utilities for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/whois/src/`
- Package: `@stacksjs/whois`

## Features
- Domain WHOIS queries
- Registration information retrieval
- Domain availability checking
- Registrar information

## Usage
```typescript
import { whois } from '@stacksjs/whois'
```

## Related
- `@stacksjs/dns` - DNS management
- `@stacksjs/domains` - Domain management via buddy CLI

## Gotchas
- WHOIS queries are rate-limited by registrars
- Results vary by TLD and registrar
- Use for informational purposes in domain management features
