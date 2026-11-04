---
name: stacks-native
description: Use when planning or implementing a Stacks feature, choosing a native API, or checking which framework capability already solves a task. A verified cheat sheet of the idiomatic call for every subsystem (models, queries, actions, routes, auth, jobs, events, mail, cache, storage, search, CMS, commerce, AI, stx, CLI, tests, deploy) plus the native package catalog, driver evidence and cross-package gotchas.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks, natively

Stacks already ships most of what an app needs. Find the row below, use that
idiom, and read the named skill before going past it. Each snippet was checked
against source. The **Gotcha** is the mistake that section most often causes.

Companion files, loaded only when needed:
[RECIPES.md](RECIPES.md) has end-to-end tracer bullets.
[CATALOG.md](CATALOG.md) maps every core package to its skill, entrypoint and
tests (browse one section, don't load all of it).
[CAPABILITIES.md](CAPABILITIES.md) records which drivers are supported, partial
or experimental.

## Ten rules

1. **Model first.** The schema, validation, relations, traits and factory all
   live in one `defineModel()`. Migrations are generated from models, never
   hand-written first.
2. **`useApi` before a custom action.** It registers authenticated CRUD at
   runtime. Write an Action only when the behavior differs from CRUD.
3. **Override, don't fork.** A file at the same path under `app/` replaces
   the default. Use `extendModel()` to add fields to a built-in model.
4. **Check auto-imports before importing.** After boot, models, jobs,
   `Action`, `route`, `response`, `schema`, `log`, `config`, `db`, `Auth`,
   `dispatch`, `mail`, `notify`, `emit` and `Feature` are server globals. See
   `storage/framework/auto-imports/RUNTIME.md`. Model files, tests and imported
   `.ts` modules still import explicitly.
5. **Use runtime subpaths in handlers:** `@stacksjs/actions/runtime`,
   `@stacksjs/database/runtime` and `@stacksjs/validation/runtime`. The full
   barrels load tooling that a request does not need.
6. **Money is integer minor units** (cents), everywhere.
7. **Writes in a transaction go through `tx`.** Model calls inside
   `transaction()` do not join it.
8. **Failures can be silent.** `mail.send`, `notify` and `dispatch` resolve
   on failure, and every `log.*` call is async. Check results, use the
   `OrFail`/`AndCollect` variants, and `await log.flush()` before exiting.
9. **A config type is not driver support.** Check CAPABILITIES.md before
   promising a provider.
10. **Prove it.** Run `./buddy lint`, the relevant `./buddy test`, and
    `./buddy typecheck`. UI work also has to pass the `stacks-design-taste`
    preflight.

## Data

### Models (`stacks-models`, `stacks-orm`)

```ts
// app/Models/Post.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Post',
  table: 'posts',
  belongsTo: ['User'],                  // adds user_id; generated CRUD derives the owner from the session
  hasMany: { comments: 'Comment' },     // the object form names the relation explicitly
  traits: {
    useUuid: true,
    useSoftDeletes: true,               // useTimestamps is on unless set to false
    useApi: { uri: 'posts', routes: ['index', 'store', 'show', 'update', 'destroy'] },
    useSearch: { searchable: ['title'], filterable: ['status'] },
    useSeeder: { count: 20 },
    observe: true,                      // emits post:created / post:updated / post:deleted
    taggable: true,
    commentable: true,
  },
  attributes: {
    title: { fillable: true, required: true, validation: { rule: schema.string().max(120) }, factory: f => f.lorem.words(3) },
    status: { fillable: true, default: 'draft', validation: { rule: schema.enum(['draft', 'published']) } },
    secret: { hidden: true, guarded: true, encrypted: true },
  },
  casts: { meta: 'json' },              // casts sit at model level; attributes have no `cast` key
} as const)
```

- **Other attribute keys:** `unique`, `nullable`, `type`, `order`, `foreignKey`, `personal`.
- **Other traits:** `useAuth`, `billable`, `likeable`, `categorizable`,
  `useAudit`, `useActivityLog`, `prunable`, `gdpr`, `broadcastOn`/`broadcastWith`.
- **Add fields to a built-in model:**
  `export default extendModel(Order, { attributes: { note: {...} } })`.
- **Gotcha:** a misspelled trait only logs a warning and is otherwise ignored.
  Event names come from the lowercased model name with no separator, so
  `StatusReport` emits `statusreport:created`.

### Queries, transactions, pagination (`stacks-query-builder`, `stacks-database`, `stacks-pagination`)

```ts
const post = await Post.find(id)                   // undefined if missing; findOrFail throws
const rows = await Post.where('status', 'published').with('user').orderBy('id', 'desc').get()
const created = await Post.create({ title })
await created.update({ title: 'New' }); await created.delete()
await Post.update(id, data); await Post.delete(id) // static forms: row | undefined, boolean
const page = await Post.where('status', 'published').paginate(20, 2)  // (perPage, page)

import { transaction } from '@stacksjs/orm'
await transaction(async tx => tx.insertInto('posts').values({ title }).execute(), { retries: 2 })

import { db } from '@stacksjs/database/runtime'   // raw builder: selectFrom / insertInto / updateTable / deleteFrom
```

- **More helpers:** `first`, `count`, `exists`, `pluck`, `whereIn`, `latest`,
  `firstOrCreate`, `updateOrCreate`, `createMany`, `simplePaginate`,
  `cursorPaginate(perPage, cursor, ['created_at', 'id'])`, `withoutEvents`.
- **Pagination defaults:** with no arguments, `paginate()` reads
  `?page&per_page`, uses 15 per page, and caps `per_page` at 100.
- **Gotcha:** `paginate` takes `(perPage, page)`, the reverse of upstream.
  `.where(...).update()` and `.delete()` on a builder return a count, not rows.

### Migrations and seeding (`stacks-migrations`)

```sh
./buddy generate:migrations   # diff models against the snapshot and write SQL; review it, then run again to confirm no diff
./buddy migrate               # apply (--diff previews; non-interactive runs need --generate to also generate)
./buddy migrate:fresh --seed  # dev only: drops everything
./buddy seed                  # skips tables that already have rows unless --fresh
./buddy migrate:status
```

**Gotcha:** commit the model, its generated migration and the
`model-snapshot.<dialect>.json` together. A stale snapshot fails the next deploy.

## HTTP

### Actions (`stacks-actions`)

```ts
// app/Actions/PublishPostAction.ts
import { Action } from '@stacksjs/actions/runtime'
import { schema } from '@stacksjs/validation'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Publish Post',
  method: 'POST',
  validations: { note: { rule: schema.string().max(200) } },   // validated before authorize/handle
  async authorize(request) { return request.can('update', await Post.findOrFail(request.getParam('id'))) },
  async handle(request) {
    const post = await Post.findOrFail(request.getParam('id'))
    await post.update({ status: 'published' })
    return response.success(post)
  },
})
```

**Gotcha:** `model: Post` only feeds rules to an explicit
`await request.validate()`. It validates nothing by itself. An `authorize`
that returns `false` produces a 403.

### Routes, middleware, responses (`stacks-router`, `stacks-middleware`, `stacks-api`)

```ts
// routes/api.ts (mounted at /api automatically)
route.post('/posts/{id}/publish', 'Actions/PublishPostAction').middleware('auth')
route.group({ prefix: '/v1', middleware: ['auth'] }, () => {
  route.get('/me', 'Actions/Auth/GetMeAction').name('me').rateLimit(60, 'minute')
})
route.resource('tags', 'Tag', { only: ['index', 'show'] })

// Typed end to end: register imported actions, infer the client
import { createTypedClient, createTypedRouter } from '@stacksjs/router'
export const api = createTypedRouter().get('/v1/posts', PostIndexAction).post('/v1/posts', PostStoreAction, { middleware: 'auth' })
const client = createTypedClient<typeof api>({ baseUrl })
```

```ts
// app/Middleware/EnsureBeta.ts: return nothing to continue, throw to stop
export default new Middleware({ name: 'EnsureBeta', priority: 5, async handle(request) { /* ... */ } })
// app/Middleware.ts
import { defineMiddleware } from '@stacksjs/router'
export default defineMiddleware({ beta: 'EnsureBeta' })   // merged over the built-in aliases
```

- **Built-in middleware aliases:** `auth`, `guest`, `can:ability,model`,
  `throttle`, `verified`, `role`, `permission`, `abilities`, `signed`, `csrf`,
  `cors`, `site`, `env:production`, `maintenance`.
- **Responses:** `response.json(data, { status })`, `success(data, msg?)`,
  `created(data)` (both wrap the payload as `{ success, data }`), `noContent()`,
  `notFound(msg?)`, `forbidden()`, `unauthorized()`,
  `validationError(errors)`, `error(msg, status = 400)`, `serverError()`,
  `redirect(url)`, `text(s, status?)`, `view(html)`, `download(path)`.
  Returning a plain object gives raw JSON.
- **Gotcha:** there is no `route.prefix()` (use `group({ prefix })`) and no
  `response.html()` (use `view`). String action paths load lazily and don't
  infer response types; pass the imported action when a typed client needs them.

### Validation and errors (`stacks-validation`, `stacks-error-handling`)

```ts
import { schema, validate } from '@stacksjs/validation'
const data = await validate(request, { email: schema.string().email().required() })  // 422 HttpError on failure

import { fromPromise, HttpError } from '@stacksjs/error-handling'
const r = await fromPromise(fetchThing()); if (r.isErr) log.warn(r.error)            // isOk / isErr are properties
throw new HttpError(409, 'Already exists')
```

**Gotcha:** `validate()` returns only the declared fields that were sent.
Unknown fields are dropped silently.

## Auth and access (`stacks-auth`)

```ts
const session = await Auth.login({ email, password })          // { user, token, ... } | null
const user = await request.user()                              // set by the 'auth' middleware; undefined on public routes
const viewer = await Auth.user()                               // resolves the bearer token or cookie itself
const token = await Auth.createToken(user, 'cli', ['posts:read'])

// app/Gates.ts
import { defineGates } from '@stacksjs/auth'
export default defineGates({ gates: { 'edit-settings': user => user.isAdmin }, policies: { Post: 'PostPolicy' } })
// in an action
await request.authorize('update', post)                        // throws a 403
```

- **2FA:** `generateTwoFactorSetup`, `enableTwoFactor`, `verifyTwoFactorLoginCode`.
- **Passkeys:** `beginPasskeyRegistration` / `finishPasskeyAuthentication`. In the
  browser, import from `@stacksjs/auth/passkeys-browser`.
- **Gotcha:** an ability with no gate and no policy method is denied. Don't
  loosen the default row-scoping policy to make an example work. Declare an
  owner instead (see RECIPES.md).

## Background work

### Jobs and queues (`stacks-jobs`, `stacks-queue`)

```ts
// app/Jobs/SendWelcomeEmail.ts
import { Job } from '@stacksjs/queue'
export default new Job({ name: 'SendWelcomeEmail', queue: 'emails', tries: 3, backoff: [10, 30, 60], async handle({ email }: { email: string }) { /* ... */ } })

await SendWelcomeEmail.dispatch({ email })                       // global; also dispatchAfter(60, p), dispatchNow(p)
import { job } from '@stacksjs/queue'
await job('SendWelcomeEmail', { email }).delay(60).afterCommit().dispatch()   // the transaction-aware builder
```

**Gotcha:** only `job(...)` waits for a transaction to commit. Inside
`transaction()`, `Job.dispatch()` sends immediately. The driver is `sync`
locally and `database` in production, and durable drivers need a worker.

### Scheduler (`stacks-scheduler`)

```ts
// app/Scheduler.ts
export default function () {
  schedule.job('Inspire').hourly().onQueue('default')   // without onQueue it runs in the scheduler process
  schedule.action('CleanupTempFiles').everyFiveMinutes().withoutOverlapping()
  schedule.command('echo hi').dailyAt('02:00').onOneServer()
}
```

**Gotcha:** keep each chain synchronous, because configuration applies in a
microtask.

### Events and listeners (`stacks-events`, `stacks-listeners`)

```ts
// app/Events.ts: values resolve against app/Listeners, then app/Actions
import { defineEvents } from '@stacksjs/events'
export default defineEvents({ 'user:registered': ['SendWelcomeEmail'] })
// app/Listeners/NotifyOps.ts
import { defineListener } from '@stacksjs/events'
export default defineListener({ listensTo: 'invoice:settled', handle: async (payload) => { /* ... */ } })

dispatch('invoice:settled', { id })                    // fire and forget (global)
import { dispatchAndCollect } from '@stacksjs/events'
const results = await dispatchAndCollect('invoice:settled', { id })   // when you need listener failures
```

**Gotcha:** the event function is `dispatch`. The `emit` global is realtime
broadcasting, not events.

## Messaging

```ts
// Mail (stacks-mail, stacks-email)
const { html, text } = await template('welcome', { variables: { name }, subject: 'Hi' })
await mail.sendOrFail({ to: [email], subject: 'Hi', html, text })       // send() resolves on failure
const r = await new WelcomeMail(user).send(); if (!r.success) await log.error(r.message)

// Every channel at once (stacks-notifications)
const results = await notify({ userId, email, phone }, { subject: 'Shipped', body }, ['email', 'sms', 'database'])

// Single channels (stacks-sms, stacks-push, stacks-chat)
import { sms } from '@stacksjs/sms'; await sms().to('+15551234567').body('Code 1234').send()
import { send as push } from '@stacksjs/push'; await push(token, { title, body }, { driver: 'fcm' })
import { send as chat } from '@stacksjs/chat'; await chat({ content: 'Deployed' }, { driver: 'slack' })

// Realtime (stacks-realtime)
emit('orders', 'created', { id })                      // emitToUser(42, 'notice', data) targets private-user.42
```

**Gotcha:** `notify` resolves even when a channel failed, so check each
`result.success`. Only `notify` honors SMS STOP opt-outs. `emit` reaches only a
broadcast server running in the same process; otherwise it warns and does
nothing.

## Platform services

```ts
// Cache (stacks-cache): TTL in seconds, 0 = forever, omitted = config.cache.ttl
import { cache } from '@stacksjs/cache'
await cache.remember(`post:${id}`, 300, () => Post.find(id)); await cache.del(`post:${id}`)

// Storage (stacks-storage)
import { Storage } from '@stacksjs/storage'
const saved = await Storage.put(file, { disk: 'public', dir: 'avatars' })   // { path, url, ... }
await Storage.disk('s3').write('x.txt', bytes)   // disk() returns an adapter: write/read/deleteFile/publicUrl

// Search (stacks-search-engine), from the useSearch trait
const hits = await Post.search('widget').where({ status: 'published' }).paginate(20, 1)

// Logging, env, config (stacks-logging, stacks-env, stacks-config)
await log.info('Order created', { orderId }); await log.error('Charge failed', err, { orderId })
import { env } from '@stacksjs/env'
const debug = env.DEBUG; const name = config.app.name   // config and log are globals; declare env keys in config/env.ts

// i18n (stacks-i18n): locales/*.yml, {name} interpolation
t('greeting', { name })

// Feature flags vs bundles (stacks-feature-flags, stacks-features)
if (await Feature.for(user.id).active('new-checkout')) { /* user-scoped rollout, async */ }
import { feature } from '@stacksjs/config'; if (feature('commerce')) { /* framework bundle, sync */ }
```

**Gotcha:** `cache` has no `forget()`; use `del`. `Storage.disk()` has no
`put`/`get`. The search index holds only `id` plus the listed fields. Read
`config` after `await overridesReady` in boot-time code. `setLocale` is
process-global; use `applyRequestLocale(req)` per request.

## Domains

```ts
// CMS (stacks-cms): built-in Post, Author, Page, Menu, Redirect, Comment, Tag models
import { authors, posts } from '@stacksjs/cms'
const published = await posts.fetchByStatus('published'); await posts.fetchByAuthor(authorId)
// override a CMS endpoint: create app/Actions/Cms/PostIndexAction.ts

// Payments and commerce (stacks-payments, stacks-commerce): integer cents
import { Payment } from '@stacksjs/payments'
const session = await Payment.checkout(user, { mode: 'payment', lines: [{ price: 'price_x', quantity: 1 }], successUrl, cancelUrl })
await Payment.subscribe(user, 'premium-monthly')
import { commerce } from '@stacksjs/commerce'; await commerce.orders.placeOrder({ order, items, payment, idempotencyKey })

// AI (stacks-ai): provider comes from config ai.default, a provider name or model id
import { createAIClient, createEmbedding } from '@stacksjs/ai'
import { ai } from '@stacksjs/config'
const { content } = await createAIClient(ai).generate([{ role: 'user', content: 'Hi' }], { system: 'Be brief.' })
```

- **Sites:** `@stacksjs/sites` provides `siteResolver`, `currentSite()` and
  `forSite(query, column, siteId)`. Queries are not scoped to a site automatically.
- **Newsletter:** `newsletter.subscribe(email, { list })` from `@stacksjs/newsletter`.
- **Analytics:** render `getAnalyticsHead(analytics)` in your layout. Nothing
  is injected for you.
- **Images:** `image(src).widths([320, 640]).formats(['avif', 'webp']).generate()`.
- **Charts:** `new Chart(canvas, { type, data })` from `@stacksjs/charts`.
- **Gotcha:** the default `User` is not `billable`. Publish it and enable the
  trait before calling `user.checkout()`. `ask()`/`summarize()` always use
  Bedrock, and `createEmbedding` defaults to OpenAI.

## Utilities (`stacks-strings`, `stacks-arrays`, `stacks-collections`, `stacks-datetime`, `stacks-slug`)

```ts
import { camelCase, plural, slug, truncate } from '@stacksjs/strings'   // slug('Hello World') -> 'hello-world'
import { chunk, groupBy, sortBy, unique } from '@stacksjs/arrays'
collect(users).pluck('name').toArray()                                  // collect is a server global
import { now } from '@stacksjs/datetime'; now().addDays(3).format('YYYY-MM-DD')   // immutable, months 1-based
import { uniqueSlug } from '@stacksjs/slug'; await uniqueSlug(title, { table: 'posts', column: 'slug' })
```

**Gotcha:** `uniqueSlug` checks first and writes later, so keep a UNIQUE
index. `arrays.range()` is a statistic (max minus min), not a sequence.

## Frontend (`stacks-stx`, `stacks-composables`, `stacks-ts-css`, `stacks-ui`)

```stx
@extends('layouts/default')
<script server>
const post = await Post.where('slug', String(params?.slug || '')).first()   // resources/views/posts/[slug].stx
if (!post) notFound()
</script>
<script client>
const likes = state(0)
const label = derived(() => `${likes()} likes`)
const { data: comments, loading } = useFetch('/api/comments')
</script>
@section('content')
  <h1 class="text-2xl font-semibold dark:text-white">{{ post.title }}</h1>
  @foreach (post.tags as tag) <span>{{ tag }}</span> @endforeach
  <button @click="likes.update(n => n + 1)"><i class="i-hugeicons-favourite"></i> {{ label() }}</button>
  <Card :title="post.title" />
@endsection
```

- **Signals:** read with `count()`, write with `.set()` or `.update()`.
  There is no `.value`.
- **Composables in client scripts:** `useFetch`, `useQuery`, `useMutation`,
  `navigate`, `toast.success()`, `useColorMode`, `useDark`, `keptState`.
  `useForm` is delivered on demand.
- **Gotchas:**
  - No `var`, `document` or `window` in stx scripts.
  - `@foreach` takes no `$` sigil.
  - Class names must be complete static strings, or added to `safelist`.
  - The bare stx `useForm(schema, initial)` and the imported
    `@stacksjs/composables` `useForm({ ... })` are different APIs.
  - Imported `.ts` modules get no auto-imports.

## CLI, tests, dev, deploy

```ts
// app/Commands/Greet.ts, auto-discovered (scaffold with: buddy make:command)
import { defineCommand } from '@stacksjs/cli'
export default defineCommand({
  name: 'greet <who>', description: 'Greet a user',
  options: { '--loud, -l': { description: 'Shout', default: false } },
  handle(options, who) { console.log(options.loud ? who.toUpperCase() : who) },  // options come first
})
```

```ts
// tests/feature/posts.test.ts (stacks-testing)
import { actingAs, describe, expect, test } from '@stacksjs/testing'
import { assertDatabaseHas, factory, refreshDatabase } from '@stacksjs/testing/database'   // DB helpers come from /database
test('creates a post', async () => {
  await refreshDatabase()
  const user = await factory('User').create()                  // actingAs needs a persisted user
  await actingAs(user).post('/api/posts', { title: 'Hi' })
  await assertDatabaseHas('posts', { title: 'Hi' })
})
```

```sh
./buddy dev                   # frontend :3000, api :3008, dashboard :3002, docs :3006 (also dev:api, dev:dashboard)
./buddy test                  # --feature / --unit / a path
./buddy build                 # interactive picker; without a TTY it builds the frontend views
./buddy deploy --dry-run      # preview first; CI needs --yes. Undo with buddy deploy:rollback
./buddy tinker                # REPL with the app booted
```

**Dashboard, desktop, mobile:** override a dashboard page at
`resources/views/dashboard/<path>.stx` (`stacks-dashboard`).
`./buddy dev:desktop` runs the app in a native window (`stacks-desktop`). The
mobile build reuses the stx views (`stacks-mobile`).

## Cross-cutting boundaries

- **Bundles and routes are separate.** Optional bundles control which models,
  migrations and views are selected. Route mounting has its own registry, so
  an installed package does not mean its routes are mounted or public.
- **Four kinds of browser names.** Browser declarations, stx eager bindings,
  demand-inline bindings and imported composables are different surfaces.
  Read `stacks-auto-imports` before using an unfamiliar bare name.
- **Ownership.** Generated CRUD derives the owner from the authenticated user.
  Test it with real requests and another user's rows, not a source grep.
- **Event dispatch.** Ordered dispatch is not the same as awaiting listeners.
  Use the result-bearing API when the caller needs outcomes.
- **Skill vs source.** If a skill and the source disagree, trust the source and
  fix the skill in the same change.

## Keeping this current

Inside the framework repository, `./buddy docs:native-skills` regenerates
CATALOG.md and CAPABILITIES.md. `./buddy docs:native-skills:check` reports a
package without guidance or a stale reference. That check proves coverage, not
that every sentence is right, so verify an idiom against its source entrypoint
before relying on an edge case.
