---
name: stacks-config
description: Use when working with Stacks configuration — the 44 config files, config helper functions, default values, environment-specific overrides, or the defineApp/defineDatabase/etc builder functions. Covers @stacksjs/config and the config/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Configuration

## Key Paths
- Core package: `storage/framework/core/config/src/`
- Configuration directory: `config/`
- Defaults: `storage/framework/core/config/src/defaults.ts`
- Overrides: `storage/framework/core/config/src/overrides.ts`

## Config API

```typescript
import { config, getConfig } from '@stacksjs/config'

config.app.name       // 'Stacks'
config.database       // full database config
config.auth           // auth config
getConfig()           // returns full StacksOptions
```

## Individual Config Exports

```typescript
import { ai, analytics, app, auth, cache, cloud, cli, database, dns, docs, email, errors, git, hashing, library, logging, notification, payment, ports, queue, realtime, security, saas, searchEngine, services, filesystems, team, ui } from '@stacksjs/config'
```

## Config Builder Functions

```typescript
import { defineApp, defineDatabase, defineCache, defineEmail } from '@stacksjs/config'

// Used in config files:
export default defineApp({
  name: 'My App',
  env: 'production',
  url: 'https://myapp.com'
}) satisfies AppConfig
```

All builders: `defineApp`, `defineCache`, `defineCdn`, `defineChat`, `defineCli`, `defineDatabase`, `defineDependencies`, `defineDns`, `defineEmailConfig`, `defineEmail`, `defineGit`, `defineHashing`, `defineLibrary`, `defineNotification`, `definePayment`, `defineQueue`, `defineSearchEngine`, `defineSecurity`, `defineServices`, `defineSms`, `defineFilesystems`, `defineUi`, `defineModel`, `defineEvents`

## Helper Functions
- `determineAppEnv(): 'dev' | 'stage' | 'prod' | string`
- `localUrl(): string` — local development URL

## All 44 Config Files

### Core App
| File | Type | Key Settings |
|------|------|-------------|
| `app.ts` | AppConfig | name, env, url, debug, key, timezone, locale |
| `auth.ts` | AuthConfig | guards, providers, tokenExpiry(30d), tokenRotation(7d), passwordReset |
| `database.ts` | DatabaseConfig | default driver, connections (sqlite/mysql/postgres/dynamodb), queryLogging |
| `cache.ts` | CacheConfig | driver('memory'), ttl(3600), maxKeys(-1), redis config |
| `env.ts` | EnvConfig | validation schemas for env vars |
| `stacks.ts` | StackExtensionRegistry | extension definitions |

### Services
| File | Type | Key Settings |
|------|------|-------------|
| `email.ts` | EmailConfig | from, domain, mailboxes, server config, ports, categorization, default('ses') |
| `sms.ts` | SmsConfig | enabled(false), provider('twilio'), drivers (twilio/vonage/pinpoint) |
| `notification.ts` | NotificationConfig | default('email') |
| `payment.ts` | PaymentConfig | driver('stripe'), stripe keys |
| `ai.ts` | AiConfig | default model, AWS Bedrock models |
| `analytics.ts` | AnalyticsConfig | driver('fathom'), tracking settings |

### Infrastructure
| File | Type | Key Settings |
|------|------|-------------|
| `cloud.ts` | CloudConfig | project, mode(server/serverless), environments, infrastructure |
| `dns.ts` | DnsConfig | a, aaaa, cname, mx, txt records, nameservers |
| `queue.ts` | QueueConfig | default('sync'), connections (sync/database/redis/sqs/memory) |
| `realtime.ts` | RealtimeConfig | enabled(true), mode, driver, channels, WebSocket config |
| `search-engine.ts` | SearchEngineConfig | driver('opensearch') |

### Development
| File | Type | Key Settings |
|------|------|-------------|
| `ports.ts` | Ports | frontend:3000, backend:3001, admin:3002, ... api:3008 |
| `lint.ts` | PickierOptions | format rules, indent, quotes, semi |
| `git.ts` | GitConfig | hooks, scopes, commit types |
| `commit.ts` | UserConfig | cz-git conventional commit config |
| `logging.ts` | LoggingConfig | logsPath, deploymentsPath |
| `docs.ts` | BunPressOptions | docsDir, outDir, nav, sitemap |

### Security
| File | Type | Key Settings |
|------|------|-------------|
| `security.ts` | SecurityConfig | firewall (enabled, countryCodes, rateLimitPerMinute:500) |
| `hashing.ts` | HashingConfig | driver('bcrypt'), bcrypt.rounds(12), argon2 config |

### Features
| File | Type | Key Settings |
|------|------|-------------|
| `blog.ts` | BlogConfig | subdomain, postsPerPage, enableComments/RSS/sitemap |
| `cms.ts` | CmsConfig | content management settings |
| `saas.ts` | SaasConfig | plans (Hobby/Pro/Lifetime with pricing), webhook, currencies |
| `ui.ts` | HeadwindOptions | content, output, minify |
| `stx.ts` | StxOptions | componentsDir, layoutsDir, partialsDir |

### Data & Storage
| File | Type | Key Settings |
|------|------|-------------|
| `filesystems.ts` | FilesystemsConfig | driver('bun'), root, s3 config, defaultVisibility('private') |
| `file-systems.ts` | — | re-exports from filesystems.ts |
| `query-builder.ts` | — | re-exports from qb.ts |
| `qb.ts` | QueryBuilderConfig | dialect, timestamps, pagination, softDeletes, transactions |

### Other
| File | Type | Key Settings |
|------|------|-------------|
| `buddy-bot.ts` | BuddyBotConfig | repository, dashboard, workflows |
| `cli.ts` | BinaryConfig | name, command, description |
| `deps.ts` | PantryConfig | system dependencies (bun, sqlite, redis, etc.) |
| `errors.ts` | ErrorConfig | comprehensive validation error messages |
| `library.ts` | LibraryConfig | name, owner, webComponents, functions |
| `phone.ts` | PhoneConfig | enabled, provider, businessHours |
| `services.ts` | ServicesConfig | API keys for 20+ services |
| `team.ts` | Team | name, members |

## Default Values (from defaults.ts)
- App name: `'Stacks'`
- Cache driver: `'memory'`
- Database: SQLite at `database/stacks.sqlite`
- Hashing: bcrypt, 12 rounds
- Auth token expiry: 30 days
- Ports: frontend 3000, backend 3001, admin 3002, api 3008

## Gotchas
- Config files are TypeScript with `satisfies` for type checking
- All configs support environment variable overrides via `env.*`
- Framework provides defaults — user overrides in `~/config/*.ts`
- Two duplicate file pairs: `file-systems.ts`/`filesystems.ts` and `query-builder.ts`/`qb.ts`
- Config changes may require dev server restart
- The `services.ts` file contains API keys for AWS, Stripe, Slack, Discord, OpenAI, Anthropic, etc.
- Lazy loading is used in config to avoid circular dependencies
