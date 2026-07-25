---
name: stacks-security
description: Use when implementing security in Stacks — password hashing (bcrypt/argon2), app key generation, AES encryption/decryption, hash verification, rehashing detection, or security configuration (firewall, rate limiting, IP allowlists). Covers @stacksjs/security and config/security.ts.
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
md5Encode(value)                  // MD5 (legacy only)
base64Encode(value)               // base64
base64Verify(value, encoded)      // base64 compare
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

## Gotchas
- Default hashing is bcrypt with 12 rounds — sufficient for most applications
- `needsRehash()` compares current hash options against provided options — useful after config changes
- APP_KEY is used for `encrypt()`/`decrypt()` — generate via `buddy key:generate`
- APP_KEY format is colon-separated (validated during deployment)
- Argon2 requires more memory/time but is more resistant to GPU attacks
- `md5Encode()` exists for legacy compatibility only — never use for passwords
- The firewall config is used by cloud deployment for WAF rules
- Rate limiting is per-minute per-IP (500 default)
