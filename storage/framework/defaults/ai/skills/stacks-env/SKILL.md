---
name: stacks-env
description: Use when working with environment variables in Stacks — the typed env proxy with auto-coercion, .env file loading, AES-256-GCM encryption/decryption of env values, runtime/platform detection, CI provider detection, or the env CLI commands. Covers @stacksjs/env, config/env.ts, and .env files.
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
├── crypto.ts    # AES-256-GCM + secp256k1 encryption
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

## Encryption (AES-256-GCM)

```typescript
import { aesEncrypt, aesDecrypt, generateKeypair, encryptValue, decryptValue, getPrivateKey } from '@stacksjs/env'

// AES-256-GCM symmetric encryption
const encrypted = aesEncrypt(plaintext, password)
const decrypted = aesDecrypt(encrypted, password)

// Asymmetric encryption (secp256k1 ECIES-style)
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
```

## Gotchas
- Bun natively loads `.env` — no dotenv package needed
- The `env` proxy auto-coerces strings to booleans/numbers
- `.env` should never be committed — use `.env.example` as template
- Encryption uses AES-256-GCM for values and secp256k1 for key exchange
- `autoLoadEnv()` loads in order: `.env`, `.env.local`, `.env.{APP_ENV}`
- Runtime detection uses Bun globals and process properties
- CI provider detection checks environment variables specific to each CI system
- The `StacksEnv` type provides autocomplete for 100+ known variables
