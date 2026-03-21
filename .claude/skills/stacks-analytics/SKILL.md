---
name: stacks-analytics
description: Use when adding or configuring analytics in a Stacks application — setting up tracking, privacy-friendly analytics, or integrating analytics providers. Covers the @stacksjs/analytics package and config/analytics.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Analytics

The `@stacksjs/analytics` package provides privacy-friendly analytics integration for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/analytics/src/`
- Configuration: `config/analytics.ts`
- Package: `@stacksjs/analytics`

## Configuration
Edit `config/analytics.ts` to configure analytics providers and tracking preferences.

## Features
- Privacy-friendly by default
- Configurable tracking providers
- Server-side analytics collection
- Integration with the Stacks event system

## Usage
```typescript
import { track } from '@stacksjs/analytics'
```

## Gotchas
- Analytics must respect user privacy preferences
- Server-side tracking avoids ad-blocker issues
- Configure data retention policies in the analytics config
- Events can be tracked via the Stacks event system integration
