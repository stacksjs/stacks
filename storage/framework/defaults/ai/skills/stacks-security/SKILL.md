---
name: stacks-security
description: Use when implementing security in Stacks - password hashing (bcrypt/argon2), app key generation, AES encryption/decryption, hash verification, rehashing detection, security configuration (firewall, rate limiting, IP allowlists), or GDPR data-subject requests (access export, erasure, retention, the processing register). Covers @stacksjs/security, config/security.ts and the GDPR layer in @stacksjs/orm.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Security

## Key Paths
- Core package: `storage/framework/core/security/src/`
- Security config: `config/security.ts`
- Hashing config: `config/hashing.ts`

## Source Files
```
security/src/
├── index.ts    # all exports
├── key.ts      # generateAppKey()
├── crypt.ts    # encrypt/decrypt (AES via APP_KEY)
└── hash.ts     # password hashing (bcrypt/argon2)
```

## App Key Generation

```typescript
import { generateAppKey } from '@stacksjs/security'

const key = generateAppKey()  // 32-character random string
// Run via CLI: buddy key:generate
```

## Encryption / Decryption

```typescript
import { encrypt, decrypt } from '@stacksjs/security'

const encrypted = await encrypt('sensitive data')           // uses APP_KEY
const encrypted = await encrypt('data', 'custom-passphrase')
const decrypted = await decrypt(encrypted)
const decrypted = await decrypt(encrypted, 'custom-passphrase')
```

## Password Hashing

```typescript
import { make, check, needsRehash, info, detectAlgorithm } from '@stacksjs/security'

// Hash a password
const hash = await make('password123')                          // bcrypt (default)
const hash = await make('password123', { algorithm: 'argon2' })
const hash = await make('password123', { rounds: 14 })          // bcrypt rounds

// Verify
const valid = await check('password123', hash)  // true/false

// Check if rehash needed (e.g., after changing rounds)
const needs = needsRehash(hash, { rounds: 14 })

// Inspect hash
const hashInfo = info(hash)         // { algorithm, options }
const algo = detectAlgorithm(hash)  // 'bcrypt' | 'argon2' | 'argon2id' | ...
```

### Aliases
- `hashMake` = `make`
- `hashCheck` = `check`
- `hashNeedsRehash` = `needsRehash`
- `hashInfo` = `info`
- `makeHash` = `make`
- `verifyHash` = `check`

### Algorithm-Specific Functions
```typescript
bcryptEncode(value, rounds?)     // bcrypt hash
bcryptVerify(value, hash)        // bcrypt verify
argon2Encode(value, options?)    // argon2 hash
argon2Verify(value, hash)        // argon2 verify
base64Encode(value)               // base64
```

## HashMakeOptions
```typescript
interface HashMakeOptions {
  algorithm?: 'bcrypt' | 'argon2' | 'argon2id' | 'argon2i' | 'argon2d'
  rounds?: number      // bcrypt (default: 12)
  memory?: number      // argon2 (default: 65536)
  time?: number        // argon2 (default: 3)
}
```

## config/hashing.ts
```typescript
{
  driver: 'bcrypt',
  bcrypt: { rounds: 12 },
  argon2: { memory: 65536, time: 3 }
}
```

## config/security.ts
```typescript
{
  firewall: {
    enabled: true,
    countryCodes: [],                // block by country
    ipAddresses: {
      allowlist: [],
      blocklist: []
    },
    rateLimitPerMinute: 500,
    useIpReputationLists: true,
    useKnownBadInputsRuleSet: true
  }
}
```

## Personal data and GDPR

Data-subject requests are driven by model declarations, not by code you write per
request: `personal: true` on an attribute and `traits.gdpr` on the model (see
`stacks-models`, "Personal data (GDPR)", and `docs/guide/gdpr.md`).

```bash
buddy gdpr:export <id|email> --out file.json   # access (Art. 15/20)
buddy gdpr:erase <id|email> --dry-run          # then without --dry-run, or --yes
buddy gdpr:prune --dry-run                     # retention; PruneRetainedDataJob runs daily
buddy gdpr:register && buddy gdpr:register:check
```

```typescript
import { eraseSubject, exportSubjectData, pruneRetainedData } from '@stacksjs/orm'
```

- `GET /me/data-export` (auth bundle, `auth` middleware, 3/hour) is the
  self-service export; the subject is always the caller.
- Erasure runs in one transaction with its `gdpr_requests` audit row, writes only
  rows it matched to the subject, then revokes tokens and destroys sessions.
- Erasure of the `User` row anonymizes rather than deletes: orders, payments and
  memberships still point at it. Consent and suppression records are kept by
  declaration, since honouring an opt-out needs the address.
- The audit ledger stores counts, never values. Do not log export payloads with
  `log`, which writes to disk in production.

## Gotchas
- Default hashing is bcrypt with 12 rounds — sufficient for most applications
- `needsRehash()` compares current hash options against provided options — useful after config changes
- APP_KEY is used for `encrypt()`/`decrypt()` — generate via `buddy key:generate`
- APP_KEY format is colon-separated (validated during deployment)
- Argon2 requires more memory/time but is more resistant to GPU attacks
- Base64 is encoding, not hashing. Never use `base64Encode()` for credentials.
- MD5 and base64 password verification are intentionally absent from the main security API.
- The firewall config is used by cloud deployment for WAF rules
- Rate limiting is per-minute per-IP (500 default)
