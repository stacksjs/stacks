---
name: stacks-http
description: Use when working with HTTP utilities in a Stacks application — making HTTP requests, handling responses, HTTP client configuration, or HTTP-related helpers. Covers the @stacksjs/http package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks HTTP

The `@stacksjs/http` package provides HTTP utilities and methods for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/http/src/`
- External tool: ~/Code/Tools/httx/
- Package: `@stacksjs/http`

## Features
- HTTP client utilities
- Request/response helpers
- HTTP method utilities
- Integration with `@stacksjs/httx`

## CLI Commands
- `buddy http` - HTTP utility commands

## Usage
```typescript
import { get, post, put, del } from '@stacksjs/http'
```

## Gotchas
- HTTP utilities wrap common request patterns
- For API route handling, use `@stacksjs/router` instead
- HTTP client is for making outbound requests
- The underlying library is `@stacksjs/httx` from ~/Code/Tools/httx/
