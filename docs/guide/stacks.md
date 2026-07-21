# Stacks Architecture

Stacks is a full-stack TypeScript framework for web, API, desktop, CLI, and cloud applications. Bun is the runtime, package manager, test runner, and bundler. Framework packages are first-party and available under `storage/framework/core/`.

[Open the interactive runtime architecture diagram](/diagrams/stacks-runtime.html).

## Application and framework layers

Your application owns the stable override surfaces:

```text
app/                 actions, jobs, listeners, middleware, models
config/              typed application and service configuration
database/            generated and custom migrations, seeders, SQLite files
resources/           stx views, components, layouts, functions, assets
routes/               web and API route files
```

Framework defaults live under `storage/framework/defaults/`. Resolution checks `app/` first and then falls back to the matching default. To customize a built-in action or model, publish or create the same relative path in `app/`.

## Request path

1. rpx and tlsx terminate local HTTPS and forward the pretty application URL.
2. stx renders the requested view or the router matches an HTTP route.
3. middleware handles authentication, authorization, locale, and request concerns.
4. an action executes application logic.
5. models and the query builder read or write the configured database.
6. events and queued jobs move non-blocking work to workers.

Craft desktop and tray windows use this same request path. They do not run a second web framework.

## Routes and actions

Register route files in `app/Routes.ts` and keep application logic in actions.

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.get('/products', 'Actions/ProductIndexAction')
route.post('/products', 'Actions/ProductStoreAction')
```

```typescript
// app/Actions/ProductIndexAction.ts
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Index',
  async handle() {
    return response.json(await Product.all())
  },
})
```

Models under `app/Models/` and jobs under `app/Jobs/` are server auto-imports. Framework primitives such as `route`, `response`, `Action`, `schema`, and `defineModel` should be imported explicitly, following the built-in defaults.

## Models and migrations

Stacks models contain schema, validation, relationships, factories, and behavior traits in one definition.

```typescript
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Product',
  table: 'products',
  traits: {
    useTimestamps: true,
    useSeeder: { count: 20 },
    useApi: {
      uri: 'products',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },
  attributes: {
    name: {
      fillable: true,
      required: true,
      validation: { rule: schema.string().maxLength(100) },
    },
    price: {
      fillable: true,
      validation: { rule: schema.number().min(0) },
    },
  },
})
```

Migrations are normally derived from model changes:

```bash
buddy generate:migrations
buddy migrate --diff
buddy migrate
```

Use `buddy make:migration` only when a migration cannot be represented by a model change.

## stx frontend

Views and components use stx with Crosswind utility classes. Browser auto-imports include signals and composables such as `state`, `derived`, `effect`, `useFetch`, `useStorage`, and `useDark`.

```stx
<script client>
const count = state(0)
const doubled = derived(() => count() * 2)
</script>

<button type="button" class="px-3 py-2 bg-blue-600 rounded-lg" @click="count.set(count() + 1)">
  {{ count() }} / {{ doubled() }}
</button>
```

Use stx signals and composables in templates. Do not add Vue, React, or direct DOM scripting to a Stacks view.

## Background work

Jobs live in `app/Jobs/` and are dispatched through the queue package. Events are registered in `app/Events.ts`, with listeners under `app/Listeners/`. Schedules live in `app/Scheduler.ts`.

```bash
buddy queue:work
buddy queue:list
buddy schedule:list
```

## Development and operations

Buddy owns the framework lifecycle:

```bash
buddy doctor
buddy dev
buddy test
buddy lint
buddy build
buddy deploy
```

Pretty HTTPS URLs are the local default. rpx supplies the reverse proxy and tlsx supplies trusted local certificates. `STACKS_DEV_LOCALHOST=1` is an explicit CI or troubleshooting opt-out.

Cloud deployments use `@stacksjs/ts-cloud` to generate and manage AWS infrastructure. The same application can target server, serverless, and static-site workloads through typed cloud configuration.

## Package boundaries

Each subsystem has a focused package under `storage/framework/core/`, including router, actions, ORM, database, queue, auth, cache, storage, realtime, cloud, desktop, server, testing, validation, and UI. Application code imports the narrow package it needs instead of a monolithic runtime.

Use the package reference pages in the documentation sidebar for subsystem APIs and the Buddy reference for commands and flags.
