---
name: stacks-tunnel
description: Use when setting up a local development tunnel for a Stacks application — exposing local dev server to the internet for testing webhooks, sharing, or mobile testing. Covers @stacksjs/tunnel.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Tunnel

The `@stacksjs/tunnel` package provides local development tunnel functionality for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/tunnel/src/`
- External tool: ~/Code/Tools/localtunnels/
- Package: `@stacksjs/tunnel`

## CLI Commands
- `buddy share` - Share your local dev server via tunnel

## Features
- Expose local development server to the internet
- Webhook testing support
- Shareable URLs for collaboration
- Mobile device testing

## Usage
Start the tunnel via the CLI:
```bash
buddy share
```

## Gotchas
- Tunnels are for development use only
- The underlying tool is from ~/Code/Tools/localtunnels/
- Tunnel URLs are temporary and change between sessions
- Ensure your dev server is running before starting the tunnel
