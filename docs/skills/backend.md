---
title: "Backend and API skills"
description: "Routes, actions, auth, jobs, events, caching and storage."
---
# Backend and API

Routes, actions, auth, jobs, events, caching and storage.

The request path and everything behind it: routes, actions, middleware, auth,
background work, events, caching and storage.

23 skills.

| Skill | What it is for |
|---|---|
| [Actions](/skills/backend/actions) | Actions are the unit of work behind a route. This covers writing them in `app/Actions/`, the ones the `useApi` trait generates for free, and the 80+ default actions the framework ships that you can call or override. |
| [AI](/skills/backend/ai) | The AI layer: Anthropic, OpenAI, Ollama and AWS Bedrock drivers, image generation, vision, RAG and embeddings, MCP clients, and the higher-level helpers for summarization, sentiment and classification. |
| [API](/skills/backend/api) | Everything about the API surface: defining endpoints, handling requests and responses, API middleware, the outbound HTTP client, API resources, and OpenAPI generation. |
| [Auth](/skills/backend/auth) | Authentication and authorization end to end: passkeys, TOTP and 2FA, RBAC, gates in `app/Gates.ts`, policies, sessions, tokens, email verification, password resets and rate limiting. |
| [Cache](/skills/backend/cache) | Memory and Redis caching behind one interface, the cache-aside `getOrSet` pattern, TTL management and cache statistics. |
| [Cron](/skills/backend/cron) | Cron expression parsing and OS-level job registration. The layer under [Scheduler](/skills/backend/scheduler), and rarely what you want directly. |
| [Error handling](/skills/backend/error-handling) | The `Result` type, the central error handler, and how errors render: stack traces in development, friendly pages in production. |
| [Events](/skills/backend/events) | Dispatching and listening: the event emitter, model events that fire on their own when a model sets `observe: true`, wildcard listeners, and the `app/Events.ts` registry. |
| [Health](/skills/backend/health) | Health checks and service monitoring. Currently a work in progress, with an Oh Dear integration planned. |
| [HTTP](/skills/backend/http) | HTTP status codes, outbound requests through the `HttxClient`, and the reactive fetch composables that call them from a template. |
| [Jobs](/skills/backend/jobs) | Writing the job classes in `app/Jobs/`: the handle method, the queue, retry and timeout configuration, and the dispatch patterns. |
| [Listeners](/skills/backend/listeners) | The other half of events: writing listeners in `app/Listeners/`, registering them, the listener-to-action mapping, and how to tell whether one actually ran. |
| [Logging](/skills/backend/logging) | The `log` facade, the `dump` and `dd` debugging helpers, timing functions, and where log files are written. |
| [Middleware](/skills/backend/middleware) | Defining middleware, applying it to routes, aliasing it in the `app/Middleware.ts` registry, parameterizing it, grouping it, and the order the pipeline runs in. |
| [Queue](/skills/backend/queue) | The queue system itself: workers, batches, failed jobs, queue events, health checks, testing, and the Redis, database and sync drivers. |
| [Realtime](/skills/backend/realtime) | WebSocket broadcasting: public, private and presence channels, emitting to a specific user, the `Channel` class, broadcast discovery and the server lifecycle. |
| [Router](/skills/backend/router) | The routing layer in full: HTTP methods, groups, middleware, named routes and URL generation, plus the Laravel-style request helpers, the response helpers, route model binding and rate limiting. |
| [Routes](/skills/backend/routes) | Where route files live and how they get registered. The organisational half of routing: files under `routes/`, the `app/Routes.ts` registry, prefixes and middleware groups. |
| [Scheduler](/skills/backend/scheduler) | Scheduled tasks in `app/Scheduler.ts`, with a cron-like fluent surface over the low-level parsing in [Cron](/skills/backend/cron). |
| [Security](/skills/backend/security) | The primitives underneath auth: password hashing, app key generation, AES encryption, hash verification and rehashing, plus the firewall, rate limit and IP allowlist configuration. |
| [Socials](/skills/backend/socials) | OAuth2 sign-in with GitHub, Google, Facebook and Twitter. Covers the provider base class, PKCE, state handling, scopes and the social profile shape. |
| [Storage](/skills/backend/storage) | Files, local or on S3, behind one `Storage` facade: put, get, delete, copy, move and list, plus uploads, visibility, checksums, temporary URLs and the disk configuration. |
| [Validation](/skills/backend/validation) | Type guards, numeric checks, and the schema builder that model attributes and request validation are both written against. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
