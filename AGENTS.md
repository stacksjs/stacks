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
- Use **stx** for templating, never vanilla JS (`var`, `document.*`, `window.*`) in stx templates.
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
| `storage/framework/` | Framework internals and **defaults** (`defaults/app/`, `models/`, `orm/`, `server/`, `dashboard`); read-only reference, do not edit unless working on the framework |
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

### Common CLI (see `stacks-buddy` for the full set)
```bash
buddy dev                 # start the dev server (buddy dev:components for the component playground)
buddy make:model Post     # scaffold a model (also make:action, make:migration, make:component,
                          #   make:job, make:middleware, make:notification, make:command, ...)
buddy migrate             # run migrations (buddy migrate:fresh to drop + recreate + seed)
buddy build               # build the project
buddy test                # run the test suite
buddy deploy              # deploy (build then deploy)
```

The recommended order for a new feature is **model, migration, action, route, test** (see
`stacks-new-feature`).

---

## Stack essentials (frontend)

- **Templating:** stx `.stx` Single File Components (`<script server|client>`, `<template>`,
  `<style>`; Blade directives `@if` / `@foreach` / `@layout`; `{{ x }}`; filters `{{ x | currency }}`).
- **Never** use `var`, `document.*`, or `window.*` in stx `<script>` blocks. Use signals
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
