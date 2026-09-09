---
name: stacks-analytics
description: Use when adding analytics to a Stacks application - configuring Fathom, Plausible, Google Analytics or self-hosted analytics, generating tracking scripts, privacy-friendly analytics setup, or the analytics configuration. Covers @stacksjs/analytics and config/analytics.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Analytics

Privacy-friendly analytics with four drivers: Fathom, Plausible, Google Analytics
and self-hosted.

## Key Paths
- Core package: `storage/framework/core/analytics/src/`
- Drivers: `storage/framework/core/analytics/src/drivers/`
- Registry (dispatch on the configured driver): `storage/framework/core/analytics/src/registry.ts`
- Configuration: `config/analytics.ts`

## Driver registry

Read `config/analytics.ts` and render the driver it names. This is the entry
point; reach for an individual driver only when you need one specific script
regardless of config.

```typescript
import { generateAnalyticsScript, getAnalyticsHead } from '@stacksjs/analytics'
import { analytics } from '@stacksjs/config'

// HTML you can drop into a layout <head>
const script = generateAnalyticsScript(analytics)

// Or the [tag, attributes] pairs a docs `head` array takes
const head = getAnalyticsHead(analytics)
```

The registry is loud on purpose. A `driver` value with no implementation throws,
and so does a driver that is selected but missing its config (the message names
the exact key to set). Only an app with no `driver` at all gets an empty result.

Nothing injects the script for you - a framework that silently posted pageviews
to a third party would be the wrong default. Render it yourself in the layout
that should carry it.

## Drivers

### Fathom
Hosted, cookie-free, GDPR-compliant. Requires a Fathom account.
`scriptUrl` points the tag at your own origin so a content blocker does not drop it.

```typescript
import { generateFathomScript } from '@stacksjs/analytics'

generateFathomScript({
  siteId: 'ABCDEFGH',
  honorDnt: true,      // -> data-honor-dnt="true"
  spa: true,           // -> data-spa="auto"
  scriptUrl: undefined, // defaults to Fathom's CDN
})
```

### Plausible
Cookie-free, hosted or self-hosted. `hashMode` and `trackLocalhost` pick the
script variant (`script.hash.js`, `script.local.js`); `scriptUrl` overrides the
computed URL entirely, which is how you point at a self-hosted install.

```typescript
import { generatePlausibleScript } from '@stacksjs/analytics'

generatePlausibleScript({ domain: 'example.com', hashMode: true })
```

### Google Analytics
GA4 via gtag.js. Emits the loader plus the inline `js` / `config` bootstrap;
`debug: true` sets `debug_mode` so the property shows up in DebugView.

```typescript
import { generateGoogleAnalyticsScript } from '@stacksjs/analytics'

generateGoogleAnalyticsScript({ trackingId: 'G-XXXXXXXXXX', debug: false })
```

### Self-Hosted
A small first-party tracker that POSTs to your own endpoint.

```typescript
import { generateSelfHostedScript, getSelfHostedAnalyticsHead } from '@stacksjs/analytics'

const script = generateSelfHostedScript({
  siteId: 'ABCDEF',
  apiEndpoint: 'https://analytics.myapp.com/api/event',
  honorDnt: true,                // respect Do Not Track
  trackHashChanges: false,       // track hash URL changes
  trackOutboundLinks: true       // track external link clicks
})

const headConfig = getSelfHostedAnalyticsHead({
  siteId: 'ABCDEF',
  apiEndpoint: 'https://analytics.myapp.com/api/event'
})
```

## Driver config interfaces

```typescript
interface FathomConfig {
  siteId: string                  // Fathom site ID
  scriptUrl?: string              // serve the script first-party
  honorDnt?: boolean              // respect Do Not Track
  spa?: boolean                   // re-record pageviews on client routing
}

interface PlausibleConfig {
  domain: string                  // the site's domain
  scriptUrl?: string              // self-hosted Plausible or a proxy
  trackLocalhost?: boolean        // keep localhost pageviews
  hashMode?: boolean              // count hash routes
}

interface GoogleAnalyticsConfig {
  trackingId: string              // GA4 measurement ID
  debug?: boolean                 // debug_mode -> DebugView
}

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
  driver: 'fathom',              // 'fathom' | 'plausible' | 'google-analytics' | 'self-hosted'
  drivers: {
    googleAnalytics: { trackingId: '' },
    fathom: { siteId: '' },
    plausible: { domain: '' },
    selfHosted: { siteId: '', apiEndpoint: '' },
  }
}
```

## First-party pageview capture

Separate from the drivers, and no script at all: `capturePageviews: true` has the
stx servers record page GETs into `analytics_events`, which is what feeds the
native `/analytics/pages`, `/referrers` and `/devices` dashboards.

## Dashboard Integration

Analytics dashboard at `/dashboard/analytics` displays:
- Page views and visitor counts
- Traffic sources
- Popular pages
- Engagement metrics

## Gotchas
- Selecting a driver does not inject anything - call `generateAnalyticsScript()` in your layout
- A misconfigured driver throws rather than emitting nothing; the message names the config key
- `honorDnt: true` respects browser Do Not Track settings
- Attribute values are escaped, and inline script values are JS-escaped, to prevent XSS
- Fathom is a paid service - self-hosted is free but requires infrastructure
- `trackOutboundLinks` adds click handlers to external `<a>` tags
- `capturePageviews` is server-side and independent of `driver`
