# AGENTS.md

Canonical guidance for AI coding agents (Claude Code, OpenAI Codex CLI, Cursor, and others) working
in this Stacks application. `CLAUDE.md` is a symlink to this file, so both agents read the same rules.

Stacks is a full-stack TypeScript framework that runs on Bun. Almost every subsystem has a dedicated
skill under `.claude/skills/` that documents it authoritatively. **This file is a map: it states the
non-negotiable rules and points you to the right skill for the task.** Read the relevant `SKILL.md`
before doing non-trivial work in that area rather than guessing an API.

---

## Project conventions (mandatory)

### Linting
- Use **pickier** for linting, never eslint directly.
- Lint: `bunx --bun pickier .` . Auto-fix: `bunx --bun pickier . --fix` .
- For unused-variable warnings, prefer `// eslint-disable-next-line` over prefixing with `_`.

### Frontend
- Use **stx** for templating, never vanilla JS (`var`, `document._`, `window._`) in stx templates.
- Use **Crosswind** as the CSS framework (Tailwind-like utility classes).
- stx `<script>` tags may only contain stx-compatible code (signals, composables, directives).

### Dependencies
- **buddy-bot** handles dependency updates, not renovatebot.
- **better-dx** provides shared dev tooling as peer dependencies; do not install its peers (e.g.
  `typescript`, `pickier`, `bun-plugin-dtsx`) separately if `better-dx` is already in `package.json`.
- If `better-dx` is in `package.json`, ensure `bunfig.toml` sets `linker = "hoisted"`.

### Commits
- Use conventional commit messages (`fix:`, `feat:`, `chore:`, ...).
- Only commit or push when asked. If on the default branch, branch first.

### Requirements
- Bun >= 1.3.0, SQLite >= 3.47.2. TypeScript throughout.

---

## Repository map

| Path | What lives here |
|---|---|
| `app/` | Your application code (see the override model below): `Actions/`, `Jobs/`, `Listeners/`, `Middleware/`, `Mail/`, `Commands/`, `Models/`, and top-level `Routes.ts`, `Events.ts`, `Gates.ts`, `Scheduler.ts`, `Middleware.ts`, `Commands.ts`, `Listener.ts` |
| `routes/` | Route files (`api.ts`, `web`, `v1.ts`, `users.ts`, ...), registered via `app/Routes.ts` |
| `config/` | ~44 typed config files (`app.ts`, `database.ts`, `auth.ts`, `api` via `services.ts`, `queue.ts`, `cache.ts`, `email.ts`, `commerce.ts`, `cms.ts`, `payment.ts`, `ai.ts`, `cloud.ts`, `ui.ts`, `crosswind.ts`, ...) |
| `database/` | `migrations/`, seeders, and the local SQLite files |
| `resources/` | stx frontend: `views/`, `components/`, `layouts/`, `partials/` |
| `storage/framework/` | Framework internals + **defaults** (`defaults/app/` including the 60+ built-in `Models/`, `core/` packages, `server/`, dashboard, and the auto-import manifests); read-only reference, do not edit unless working on the framework |
| `tests/` | Test suites (Bun test) |
| `cloud/` | AWS infrastructure (CDK / CloudFormation) for deploys |
| `content/`, `docs/`, `locales/`, `public/` | CMS/markdown content, docs site, i18n strings, static assets |

### The `app/` override model
Stacks resolves files from `app/` first and falls back to `storage/framework/defaults/app/`. To
customize a framework default (e.g. a CMS action), create the same path under `app/`
(`app/Actions/Cms/PostIndexAction.ts`) and it wins. New files you add under `app/` are available to
the app (e.g. `app/Actions/MyAction.ts` is referenced as `'Actions/MyAction'` in routes). There are
80+ default actions and 50+ built-in models you can use or override.

---

## Building features: feature → skill index

Read the skill before building. Full list of skills is in `.claude/skills/`.

### Backend / API
| Task | Skill |
|---|---|
| End-to-end new feature (model to migration to action to route to test) | `stacks-new-feature` |
| API endpoints, routes, request/response, middleware, OpenAPI, HTTP client | `stacks-api`, `stacks-router`, `stacks-routes` |
| Server actions in `app/Actions/`, auto-generated API actions (`useApi` trait), default actions | `stacks-actions` |
| Data models: `defineModel()`, attributes, relationships, traits, factories, computed | `stacks-models`, `stacks-orm` |
| Database: connections, queries, SQL helpers, SQLite/MySQL/Postgres/DynamoDB | `stacks-database`, `stacks-query-builder` |
| Migrations (create, run, fresh, seed) | `stacks-migrations` |
| Auth: authn/z, passkeys, TOTP/2FA, RBAC, gates (`app/Gates.ts`), policies, sessions, tokens | `stacks-auth`, `stacks-security` |
| Middleware in `app/Middleware/` and the `app/Middleware.ts` registry | `stacks-middleware` |
| Background jobs in `app/Jobs/`, queues, workers, batches, drivers | `stacks-jobs`, `stacks-queue` |
| Scheduling (`app/Scheduler.ts`), cron | `stacks-scheduler`, `stacks-cron` |
| Events (`app/Events.ts`) and listeners (`app/Listeners/`) | `stacks-events`, `stacks-listeners` |
| Mail classes (`app/Mail/`) and the email framework (SES/SendGrid/Mailgun/SMTP) | `stacks-mail`, `stacks-email` |
| Notifications (email/SMS/push/chat/database) | `stacks-notifications`, `stacks-sms`, `stacks-push`, `stacks-chat` |
| Caching (memory/Redis, cache-aside) | `stacks-cache` |
| File storage / uploads (local/S3) | `stacks-storage` |
| Realtime / WebSockets / channels | `stacks-realtime` |
| Full-text search (Meilisearch/Algolia, `useSearch` trait) | `stacks-search-engine` |
| Validation, error handling (Result type, error pages) | `stacks-validation`, `stacks-error-handling` |
| Env vars, config helpers, logging | `stacks-env`, `stacks-config`, `stacks-logging` |
| AI (Anthropic/OpenAI/Bedrock/Ollama), RAG, embeddings, MCP | `stacks-ai` |

### Domain packages
| Task | Skill |
|---|---|
| E-commerce (products, orders, customers, coupons, payments, shipping, tax, ...) | `stacks-commerce`, `stacks-payments` |
| CMS (posts, authors, pages, categories, tags, comments, RSS, sitemap) | `stacks-cms` |
| Admin dashboard pages, model views, widgets (150+ components) | `stacks-dashboard` |
| i18n / translations / formatting | `stacks-i18n` |
| Utilities: strings, arrays, collections, objects, datetime, slugs | `stacks-strings`, `stacks-arrays`, `stacks-collections`, `stacks-objects`, `stacks-datetime`, `stacks-slug` |

### CLI, build, deploy, test
| Task | Skill |
|---|---|
| The `buddy` / `bud` / `stacks` / `stx` CLI (50+ commands, `make:*` scaffolding, custom commands in `app/Commands/`) | `stacks-buddy`, `stacks-cli`, `stacks-scaffolding` |
| Building (components, CLI binaries, server images, docs) | `stacks-build` |
| Deploying (server vs serverless, hooks, first deploy) and cloud infra (EC2/Lambda/CDK/Route53/SES/S3) | `stacks-deploy`, `stacks-cloud` |
| Testing (DB test utils, feature tests, config) | `stacks-testing` |
| Dev server, HMR, reverse proxy, SSL | `stacks-development`, `stacks-server` |

The recommended order for a new feature is **model, migration, action, route, test** (see
`stacks-new-feature`).

---

## Auto-imports

Auto-imports let app code skip many `import` statements, but the rules differ by context and the
framework's own code is the source of truth (verified against the manifests, not just the docs).
Manifests: `storage/framework/{browser,server}-auto-imports.json`. Generated types:
`storage/framework/types/*auto-imports.d.ts`. Regenerate with `buddy generate` (`--types` for the
declarations). Full reference: `stacks-auto-imports`.

**stx templates (browser)** - available with no import:
- Vue reactivity + 200+ VueUse-style composables: `ref`, `computed`, `watch`, `reactive`,
  `watchEffect`, `useFetch`, `useDark` / `useColorMode`, `useStorage`, `useLocalStorage`, `useToggle`,
  `useCounter`, `useIntersectionObserver`, `useScroll`, `useMouse`, `useParallax`,
  `usePreferredReducedMotion`, plus utilities (`debounce`, `throttle`, `sleep`, `clamp`), `useAuth`,
  and the Stripe helpers (`loadCardElement`, `confirmPayment`, ...).
- Your components under `resources/components/` (write `<Card />` directly, resolved by the stx
  plugin) and your functions under `resources/functions/` (e.g. `increment`, `toggleDark`).

**Server** (routes, `app/Actions/`, `app/Jobs/`, models) - injected into `globalThis`:
- All 60+ models (`User`, `Product`, `Order`, ...) with their `Model` / `Request` / `RequestModel`
  variants, so `await User.find(1)` works with no import.
- Everything exported from `app/Jobs/` and `resources/functions/`.

**Import these explicitly (the framework does).** `types/auto-imports.d.ts` also declares `Action`,
`route`, `response`, `schema`, `slug`, `path`, `storage`, `log`, and `Auth` as ambient global types,
but the built-in actions and models import them from their packages anyway (`@stacksjs/actions`,
`@stacksjs/router`, `@stacksjs/validation`, ...), and so should you. `defineModel` is always imported
from `@stacksjs/orm`. When unsure, copy the import pattern from `storage/framework/defaults/app/`.
Add your own auto-imports by exporting from `resources/functions/` (browser) or the auto-import
barrel, then run `buddy generate`.

---

## Data layer: models, ORM, query builder, migrations

Stacks is Laravel-like (models, relationships, traits, factories, a fluent query builder), with one
big difference: **migrations are derived from your models, not hand-written.** You describe the
schema once in the model; Stacks diffs it against the database and generates the SQL. See
`stacks-orm`, `stacks-models`, `stacks-migrations`, `stacks-database`, `stacks-query-builder`.

### Define a model
Models live in `app/Models/` (your custom models and overrides) and
`storage/framework/defaults/app/Models/` (60+ built-ins, grouped into `commerce/`, `Content/`, etc.).
Use `defineModel()`; the whole schema, validation, factory, relationships, and behavior traits are
declared in one place.

```ts
// app/Models/Product.ts
// Models and app/Jobs are auto-imported as server globals; stx composables and
// resources/components are auto-imported in templates. In a model file you still
// import defineModel and schema explicitly, exactly as the built-in models do.
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Product',
  table: 'products',

  traits: {
    useUuid: true,
    useTimestamps: true,          // created_at / updated_at
    useSeeder: { count: 20 },     // factory-backed seeding
    useApi: {                     // auto-generate REST actions + routes
      uri: 'products',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
    useSearch: { searchable: ['name'], filterable: ['status'] },
    observe: true,                // emit product:created / :updated / :deleted events
  },

  belongsTo: ['Category'],
  hasMany: ['Review'],

  attributes: {
    name: {
      fillable: true,
      required: true,
      validation: { rule: schema.string().maxLength(100) },
      factory: faker => faker.lorem.word(),
    },
    price: {
      fillable: true,
      validation: { rule: schema.number().min(1) },
      factory: faker => faker.datatype.number({ min: 100, max: 10000 }),
    },
    status: {
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
    },
  },
})
```

Traits do real work: `useApi` generates the REST actions and routes for the model, `useAuth` adds
auth columns + passkeys, `useSearch` wires search-engine indexing, `useSeeder` enables factory
seeding, and `billable` / `taggable` / `categorizable` / `commentable` / `likeable` add their
relations and methods. See `stacks-models` for the full trait and attribute reference.

### Model-driven migration workflow
```bash
# 1. Define or change a model in app/Models/ (or storage/framework/defaults/app/Models/)
buddy generate:migrations     # 2. diff models vs current schema, emit SQL into database/migrations/
# 3. review the generated migration file
buddy migrate                 # 4. apply pending migrations   (--diff to preview SQL, --auth for auth tables)
buddy migrate:fresh --seed    #    (dev) drop everything, re-migrate, then seed
```
`buddy make:migration <name>` still exists for hand-written migrations, and 96+ migrations ship for
the built-in models. `buddy migrate` verifies models exist before running.

### Query builder
Models expose a fluent, chainable query API (backed by `bun-query-builder`) plus create/update/delete
and eager loading. Exact method surface is in `stacks-query-builder` / `stacks-orm`; typical shape:

```ts
const published = await Product.where('status', 'published').orderByDesc('created_at').all()
const product = await Product.find(id)
const created = await Product.create({ name: 'Widget', price: 1200 })
await transaction(async () => { /_ ... atomic work ... _/ })
```
Eager loading, pagination, and the full method set are in `stacks-query-builder` / `stacks-orm`.

---

## The buddy CLI

All of `./buddy`, `bud`, `stacks`, and `stx` invoke the same CLI. Run `buddy list` for everything and
`buddy <command> --help` for flags. Full reference with every flag: `stacks-buddy`.

**Develop & serve**
- `buddy dev [frontend|api|docs|dashboard|desktop]` start dev server(s) + reverse proxy; `buddy dev:components` component playground
- `buddy down` / `buddy up` enter / exit maintenance mode

**Build & generate**
- `buddy build [components|functions|views|docs|cli|server|stacks]` production builds
- `buddy generate[:types|:openapi|:migrations|:entries|:ide-helpers]` types, OpenAPI spec, migration diffs, IDE helpers

**Database**
- `buddy migrate [--diff|--auth]`, `buddy migrate:fresh [--seed]`, `buddy seed`, `buddy generate:migrations`

**Scaffold (`make:*`)**
- `make:model`, `make:migration`, `make:action`, `make:component`, `make:view` (`make:page`), `make:job`, `make:middleware`, `make:notification`, `make:policy`, `make:resource`, `make:command`, `make:factory`, `make:function`, `make:lang`, `make:database`, `make:queue-table`, `make:stack`, `make:certificate`

**Quality & test**
- `buddy lint [--fix]` / `buddy lint:fix` / `buddy format[:check]` (pickier)
- `buddy test [--unit|--feature]` / `test:unit` / `test:feature` / `test:ui` / `test:types` (`typecheck`)

**Environment**
- `buddy env:get|set|encrypt|decrypt|keypair|rotate|check` manage and encrypt `.env` values

**Cloud & deploy**
- `buddy deploy` full deploy workflow (prereqs, env, APP_KEY, AWS, DNS, mail records)
- `buddy cloud [--ssh|--diff|--invalidate-cache]`, `cloud:add --jump-box`, `cloud:remove`, `cloud:cleanup`, `cloud:optimize-cost`

**Domains & DNS**
- `buddy domains:purchase|add|remove` (Route 53), `buddy dns [domain]` DNS query tool

**Email & mail server**
- `buddy email:verify|test|list|logs|status|inbox|reprocess` (SES / S3)
- `buddy mail:user:add|list|delete`, `mail:proxy`, `mail:test`, `mail:credentials`, `mail:logs`, `mail:status`, `mail:server`, `mail:port25:*`

**Project & framework**
- `buddy install` / `fresh` / `clean` / `add` / `outdated`
- `buddy upgrade[:all|:dependencies|:bun|:shell|:binary]` upgrade framework, deps, or Bun
- `buddy about` / `buddy doctor` / `buddy list` info and health checks

Custom commands live in `app/Commands/` and register via `app/Commands.ts` (`make:command` scaffolds
one). See `stacks-cli` for building commands.

---

## Stack essentials (frontend)

- **Templating:** stx `.stx` Single File Components (`<script server|client>`, `<template>`,
  `<style>`; Blade directives `@if` / `@foreach` / `@layout`; `{{ x }}`; filters `{{ x | currency }}`).
- **Never** use `var`, `document._`, or `window._` in stx `<script>` blocks. Use signals
  (`state` / `derived` / `effect`) and composables. See `stacks-stx`, `stacks-composables`.
- **CSS:** Crosswind utilities, `dark:` variant, arbitrary values; dark mode via `useColorMode()` /
  `useDark()`. See `stacks-crosswind`, `stacks-ui`.
- **Icons:** Iconify classes `i-{collection}-{name}` (hugeicons by default). Never hand-roll SVG icon
  paths; never add npm icon packages.
- **Fonts:** the `fonts` config plus `<link>` / `@font-face` with `font-display: swap`. No `next/font`.
- **Images:** `<img>` plus the stx asset pipeline / `@stacksjs/storage`. No `next/image`.
- **Motion:** Stacks ships no animation library. Do NOT import `motion/react`, `framer-motion`, or
  `gsap`. Use Crosswind transitions, CSS keyframes, CSS scroll-driven animations
  (`animation-timeline: view()` / `scroll()`), and composables (`useIntersectionObserver`,
  `useScroll`, `useParallax`, `useMouse`). Gate anything beyond hover with
  `usePreferredReducedMotion()`. Never attach `window.addEventListener('scroll', ...)` in a template.

---

## Design & anti-slop skills (read the SKILL.md before building UI)

For any visually important page (landing, hero, marketing, portfolio, product, redesign), read the
matching skill and follow it. These translate premium design discipline into stx + Crosswind.

| When the task is | Read |
|---|---|
| Any premium / anti-slop frontend (start here) | `stacks-design-taste` |
| Stricter, award-level, high-variance + deterministic motion | `stacks-design-taste-codex` |
| Aesthetic already chosen: expensive / soft | `stacks-design-soft` |
| Aesthetic: editorial / minimalist (Notion / Linear) | `stacks-design-minimalist` |
| Aesthetic: industrial / brutalist | `stacks-design-brutalist` |
| Upgrading an existing UI (audit first) | `stacks-redesign` |
| Agent keeps truncating / placeholder output | `stacks-design-output` |
| Image-first: generate references, then implement | `stacks-image-to-code` |
| Reference images only (web / mobile / brand) | `stacks-imagegen-web`, `stacks-imagegen-mobile`, `stacks-brandkit` |

The flagship (`stacks-design-taste`) carries the shared rules: brief inference, the three dials
(VARIANCE / MOTION / DENSITY), typography / color / layout discipline, the AI-Tells list, the redesign
protocol, and a binding pre-flight check. The others refine it and defer to it.

---

## Hard rule: no em-dashes in user-visible output

Never emit an em-dash (`—`) or a separator en-dash (`–`) in any user-visible string you generate:
headlines, body copy, labels, buttons, alt text, captions. Use a regular hyphen `-`, a comma, or two
sentences. This is the single most common AI design tell and it is a pre-flight failure.

## Before finishing

- Lint: `bunx --bun pickier .` (fix with `--fix`). Run relevant tests with `buddy test`.
- For UI work, run the pre-flight check in `stacks-design-taste` (Section 14). If a box cannot be
  honestly ticked, the work is not done.
