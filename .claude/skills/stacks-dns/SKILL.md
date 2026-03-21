---
name: stacks-dns
description: Use when managing DNS records for a Stacks application — configuring domains, DNS providers, or DNS-related utilities. Covers the @stacksjs/dns package, @stacksjs/dnsx, and config/dns.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks DNS

The `@stacksjs/dns` package provides DNS management utilities for Stacks applications, powered by `@stacksjs/dnsx`.

## Key Paths
- Core package: `storage/framework/core/dns/src/`
- Configuration: `config/dns.ts`
- External tool: ~/Code/Tools/dnsx/
- Package: `@stacksjs/dns`

## CLI Commands
- `buddy dns` - DNS management commands
- `buddy domains` - Domain management

## Features
- DNS record management
- Domain configuration
- DNS provider integration
- WHOIS lookups (via `@stacksjs/whois`)

## Gotchas
- DNS changes may take time to propagate
- Configuration is in `config/dns.ts`
- The underlying library is `@stacksjs/dnsx` from ~/Code/Tools/dnsx/
- For WHOIS lookups, use the separate `@stacksjs/whois` package
