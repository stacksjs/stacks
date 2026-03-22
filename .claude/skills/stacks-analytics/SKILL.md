---
name: stacks-analytics
description: Use when adding analytics to a Stacks application — configuring Fathom or self-hosted analytics, generating tracking scripts, privacy-friendly analytics setup, or the analytics configuration. Covers @stacksjs/analytics and config/analytics.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Analytics

Privacy-friendly analytics with Fathom and self-hosted driver support.

## Key Paths
- Core package: `storage/framework/core/analytics/src/`
- Configuration: `config/analytics.ts`

## Drivers

### Fathom Analytics
Privacy-focused, GDPR-compliant analytics. Requires a Fathom account.

### Self-Hosted Analytics
Generate tracking scripts for self-hosted analytics:

```typescript
import { generateSelfHostedScript, getSelfHostedAnalyticsHead, generateInlineScript } from '@stacksjs/analytics'

// Generate tracking script tag
const script = generateSelfHostedScript({
  siteId: 'ABCDEF',
  apiEndpoint: 'https://analytics.myapp.com/api/event',
  honorDnt: true,                // respect Do Not Track
  trackHashChanges: false,       // track hash URL changes
  trackOutboundLinks: true       // track external link clicks
})

// Generate head configuration for STX
const headConfig = getSelfHostedAnalyticsHead({
  siteId: 'ABCDEF',
  apiEndpoint: 'https://analytics.myapp.com/api/event'
})

// Generate inline script (no external JS file)
const inline = generateInlineScript(config)
```

## SelfHostedConfig Interface

```typescript
interface SelfHostedConfig {
  siteId: string                  // unique site identifier
  apiEndpoint: string             // analytics API URL
  honorDnt?: boolean              // respect Do Not Track header
  trackHashChanges?: boolean      // track SPA hash navigation
  trackOutboundLinks?: boolean    // track clicks to external sites
}
```

## config/analytics.ts

```typescript
{
  driver: 'fathom',              // 'fathom' | 'google-analytics'
  drivers: {
    googleAnalytics: {
      trackingId: ''              // GA tracking ID
    },
    fathom: {
      siteId: ''                  // Fathom site ID
    }
  }
}
```

## Dashboard Integration

Analytics dashboard at `/dashboard/analytics` displays:
- Page views and visitor counts
- Traffic sources
- Popular pages
- Engagement metrics

## Gotchas
- Default driver is `fathom` — privacy-focused by default
- Self-hosted analytics require your own analytics endpoint
- `honorDnt: true` respects browser Do Not Track settings
- `escapeAttr()` is used internally to prevent XSS in generated scripts
- Google Analytics tracking ID goes in config, not env (unless you override)
- Analytics scripts are generated server-side and injected into page head
- Fathom is a paid service — self-hosted is free but requires infrastructure
- `trackOutboundLinks` adds click handlers to external `<a>` tags
