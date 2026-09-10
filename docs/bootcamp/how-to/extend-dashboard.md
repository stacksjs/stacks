---
title: Extend the Dashboard
description: "How to add pages, panels and navigation to the Stacks dashboard: stx views under resources/views/dashboard, and config/dashboard.ts for what renders."
---
# Extend the Dashboard

::: warning What this page used to say
This page documented a `@stacksjs/dashboard` package exporting `Dashboard`,
`Widget`, `DashboardPage`, `Navigation`, `Theme`, `DashboardPlugin` and
`BulkAction`. That package has never existed, in any version, and neither has
any of those classes ([#2581](https://github.com/stacksjs/stacks/issues/2581)).

The dashboard is stx views and components like the rest of the frontend, plus
`config/dashboard.ts` for what renders. There is no plugin SDK, and no widget
class to construct.
:::

## What the dashboard is

Two things:

- **`config/dashboard.ts`** decides which sections appear in the sidebar and
  where each one reads its data from.
- **stx views and components** under `resources/views/dashboard/` and
  `resources/components/Dashboard/` are the pages themselves. The framework
  ships a full set under `storage/framework/defaults/`, and anything you create
  at the same path in your own `resources/` wins.

```bash
buddy dev --dashboard
```

## Sections

Every section is on by default. Turn off what this project does not use:

```typescript
// config/dashboard.ts
import type { DashboardConfig } from '@stacksjs/types'

export default {
  enabled: true,

  sections: {
    library: { enabled: true },
    content: { enabled: true },
    // A non-commerce app hides the whole Commerce section, and its
    // categorized model rows with it.
    commerce: { enabled: false },
    marketing: { enabled: true },
    analytics: { enabled: true },
    management: { enabled: true },
    utilities: { enabled: true },

    data: {
      dashboard: { enabled: true },
      activity: { enabled: true },
      users: { enabled: true },
      teams: { enabled: true },
      // No newsletter, no Subscribers row.
      subscribers: { enabled: false },
      allModels: { enabled: true },
    },
  },
} satisfies DashboardConfig
```

Your own models under `app/Models/` are listed in the Data section
automatically, whatever these flags say. That is the point of the section, so
it is not something to opt into.

## Data providers

Each section reads from this application's database by default. Point one at a
hosted product instead:

```typescript
providers: {
  logs: { driver: 'local' },
  errors: {
    driver: 'hq',
    url: 'https://bughq.example.com',
    token: env.BUGHQ_READ_TOKEN,
  },
},
```

::: warning An ingest key is not a read token
The key an app uses to SEND logs or errors identifies a project and grants no
read access. Reusing it here produces a section that authenticates and then
returns nothing.
:::

Health has no provider and cannot be pointed anywhere. It reports the process
serving the request, and the same probe backs the framework's liveness route.

## Custom pages

A dashboard page is an stx view. Create it under
`resources/views/dashboard/`, and it is served at the matching path:

```html
<!-- resources/views/dashboard/reports.stx -->
<script server>
const revenue = await Order.where('status', 'completed').sum('total')
const orders = await Order.where('status', 'completed').count()
</script>

<template>
  <DashboardLayout title="Reports">
    <div class="grid gap-4 md:grid-cols-2">
      <StatCard label="Revenue" :value="revenue" />
      <StatCard label="Orders" :value="orders" />
    </div>
  </DashboardLayout>
</template>
```

The query runs in `<script server>`, so the numbers are computed on the server
and the page ships no client-side data fetch.

::: tip A new nested view 404s until the dev server restarts
The route table is built when the server starts. Adding a file under a
directory that did not exist needs a restart, not just a save.
:::

## Custom panels

A panel is a component, not a registered widget. Put it under
`resources/components/Dashboard/` and use it by name - components in
`resources/components/` are auto-imported into stx templates:

```html
<!-- resources/components/Dashboard/QueueDepth.stx -->
<script server>
const { queuedJobState } = await import('@stacksjs/queue')
const state = await queuedJobState()
</script>

<template>
  <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
    <h3 class="text-sm font-medium text-gray-500">Queue depth</h3>
    <p class="mt-1 text-2xl font-semibold">{{ state.pending }}</p>
  </div>
</template>
```

```html
<!-- Used with no import -->
<QueueDepth />
```

Charts are components too - `@stacksjs/charts` ships them, and they are used
the same way, with no chart config object to register.

## Overriding a shipped page

The framework's dashboard pages live under
`storage/framework/defaults/resources/views/dashboard/`. To change one, create
the same path in your own `resources/` and it wins - the same override model
`app/` uses for actions and models.

Copy the default first rather than starting empty: a dashboard page carries
layout and auth wiring that is easy to drop by accident.

## Related

- [stx](/packages/stx) - templates, signals, and server scripts
- [Components](/basics/components) - building components
- [Components reference](/guide/components/table) - the component set that ships
