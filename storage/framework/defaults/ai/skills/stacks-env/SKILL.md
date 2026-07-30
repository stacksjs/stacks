---
name: stacks-env
description: Use when working with environment variables in Stacks - the typed env proxy with auto-coercion, .env file loading, X25519 and AES-256-GCM encryption/decryption of env values, runtime/platform detection, CI provider detection, or the env CLI commands. Covers @stacksjs/env, config/env.ts, and .env files.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Environment

## Key Paths
- Core package: `storage/framework/core/env/src/`
- Environment config: `config/env.ts`
- Environment file: `.env`
- Example: `.env.example`
- Type definitions: `storage/framework/env.d.ts`

## Source Files
```
env/src/
├── index.ts     # main exports
├── utils.ts     # runtime/platform detection, StacksEnv proxy
├── plugin.ts    # Bun plugin for auto .env loading
├── parser.ts    # .env file parser with encryption support
├── cli.ts       # CLI commands (get, set, encrypt, decrypt, rotate)
├── crypto.ts    # X25519 + HKDF-SHA-256 + AES-256-GCM encryption
└── types.ts     # StacksEnv interface (100+ typed vars)
```

## Typed Environment Proxy

```typescript
import { env } from '@stacksjs/env'

env.APP_NAME        // string
env.APP_ENV         // 'local' | 'dev' | 'stage' | 'prod'
env.APP_KEY         // string
env.APP_URL         // string
env.DEBUG           // boolean (auto-coerced)
env.PORT            // number (auto-coerced)
env.DB_CONNECTION   // 'sqlite' | 'mysql' | 'postgres' | 'dynamodb'
env.DB_HOST         // string
env.DB_PORT         // number
env.DB_DATABASE     // string
env.DB_USERNAME     // string
env.DB_PASSWORD     // string
env.AWS_ACCESS_KEY_ID    // string
env.STRIPE_SECRET_KEY    // string
env.MAIL_MAILER          // string
env.QUEUE_DRIVER         // string
env.REDIS_HOST           // string
env[key]                 // any custom env var
```

The `env` proxy auto-coerces: `'true'` → `true`, `'123'` → `123`, etc.

## StacksEnv Type (100+ typed variables)
App, Ports, API, Database, AWS, Mail, Services (Stripe, Meilisearch), Frontend, Realtime, Redis, Pusher, Auth, Storage, Queue, plus `[key: string]` catch-all.

## Runtime Detection

```typescript
import { isBun, isNode, runtime, runtimeInfo, platform, isWindows, isMacOS, isLinux, hasTTY, hasWindow, isCI, isDebug, isMinimal, isColorSupported, provider, providerInfo } from '@stacksjs/env'

isBun           // true
isNode          // false
runtime         // 'bun'
platform        // 'darwin'
isWindows       // false
isMacOS         // true
isLinux         // false
hasTTY          // true (terminal)
isCI            // false
isDebug         // boolean
isColorSupported // true
```

## CI Provider Detection

```typescript
provider        // 'github-actions' | 'gitlab-ci' | 'circleci' | 'travis' | 'jenkins' | 'vercel' | 'netlify' | 'heroku' | 'aws' | 'azure' | 'cloudflare' | 'railway' | 'render' | ...
providerInfo    // { name: string, ... }
```

## .env File Loading

```typescript
import { loadEnv, autoLoadEnv, envPlugin } from '@stacksjs/env'

await loadEnv({ path: '.env', override: false })
autoLoadEnv()  // detects .env, .env.local, .env.{APP_ENV}

// Bun plugin (auto-loads .env before app starts)
envPlugin()
```

## .env Parser

```typescript
import { parse } from '@stacksjs/env'

const vars = parse(envContent, {
  encryption: true,       // decrypt encrypted values
  privateKey: '...'       // decryption key
})
```

## Encryption (X25519 + AES-256-GCM)

```typescript
import { aesEncrypt, aesDecrypt, generateKeypair, encryptValue, decryptValue, getPrivateKey } from '@stacksjs/env'

// AES-256-GCM symmetric encryption
const encrypted = aesEncrypt(plaintext, password)
const decrypted = aesDecrypt(encrypted, password)

// Versioned ephemeral-static X25519 envelope encryption
const keypair = generateKeypair()
const encrypted = encryptValue(value, keypair.publicKey)
const decrypted = decryptValue(encrypted, keypair.privateKey)
```

## CLI Commands

```bash
buddy env:get APP_NAME                    # get single var
buddy env:get --all --format json         # all vars as JSON
buddy env:set APP_NAME "My App"           # set var
buddy env:encrypt                          # encrypt .env file
buddy env:decrypt                          # decrypt .env file
buddy env:keypair                          # generate encryption keypair
buddy env:rotate                           # rotate encryption keys
buddy env:check                            # validate env configuration
buddy env:check --file .env.production     # check a specific environment's file
```

## Tenant isolation on a shared box

When several projects share one server - one owns it, the rest attach with
`cloud.attachTo` - each still deploys from its own repository with its own
`.env.<environment>`. No project needs another's values.

They leak anyway: a tenant's secrets get pasted into the owner's env file under
a `TENANT_` prefix while debugging a deploy, and stay. That is not just untidy.
`buddy deploy` ships the whole env file as **every** site's `.env` (ts-cloud
treats `site.env` as the complete file), so a stray `BUGHQ_STRIPE_SECRET_KEY` in
the owner's file lands on disk in an unrelated site.

Declare who is attached, in `config/cloud.ts`'s default export:

```typescript
const config: CloudConfig = {
  tenants: ['bughq', 'analyticshq'],
}
```

With that:

- `buddy deploy` drops those keys before shipping, and logs what it dropped
- `buddy env:check` lists them per tenant so they can be deleted at source

Prefixes are **never** inferred. With no `tenants` declared nothing is treated
as foreign, because `STRIPE_`, `AWS_` and `MEILISEARCH_` are indistinguishable
from a slug prefix by shape alone. Slug punctuation is ignored, so
`analytics-hq` and `analytics_hq` both match `ANALYTICSHQ_`.

The API is `partitionTenantEnv(values, { self, tenants })` from
`@stacksjs/env`, plus `stripForeignTenantEnv` and `foreignTenantKeys`.

## Dashboard environment editor

The dashboard reads and writes `.env` through guarded
`/api/dashboard/environment` GET and PUT endpoints. The write contract:

- validates uppercase environment keys and duplicate definitions
- limits the file to 1 MB and rejects null bytes
- requires the SHA-256 revision returned by the latest read
- writes through a 0600 temporary file and atomic rename
- stores the previous content under
  `storage/framework/runtime/dashboard/environment.backup`
- returns `Cache-Control: no-store` because the response contains secrets

Structured settings pages should use `updateEnvironmentEntries()` from the
dashboard environment-file service. It updates only named keys while
preserving comments, ordering, unrelated values, and the same revision and
backup guarantees. Do not implement settings with repeated `writeFileSync`
calls or raw client-side `fetch`.

## Gotchas
- **A tenant's keys in your env file get shipped everywhere.** `buddy deploy`
  sends the entire env file as each site's `.env`. Declare `tenants` in
  `config/cloud.ts` so they are stripped, then delete them at source
- Bun natively loads `.env` — no dotenv package needed
- The `env` proxy auto-coerces strings to booleans/numbers
- `.env` should never be committed — use `.env.example` as template
- New encrypted values use ephemeral-static X25519, HKDF-SHA-256, and
  AES-256-GCM. Legacy ciphertext remains readable for migration
- `autoLoadEnv()` loads in order: `.env`, `.env.local`, `.env.{APP_ENV}`
- Runtime detection uses Bun globals and process properties
- CI provider detection checks environment variables specific to each CI system
- The `StacksEnv` type provides autocomplete for 100+ known variables
