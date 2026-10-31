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

## Scanning a project: `buddy security:scan`

`buddy security:scan` (alias `buddy audit`) checks a project for security problems and exits non-zero on findings at or above `--fail-on` (default `high`), so it drops into CI. Five checks, each runnable alone with `--only` or left out with `--skip`:

| Check | Finds |
|---|---|
| `dependencies` | Known vulnerabilities in the lockfile (`bun audit`; needs the network, skipped with `--offline`) |
| `secrets` | Committed credentials: private keys, AWS/Stripe/GitHub/Anthropic/OpenAI/Slack/Google/Twilio/SendGrid/npm tokens, database URLs with passwords, `secret = "high-entropy value"` |
| `code` | `eval` / `new Function`, shell commands built from strings, SQL built with interpolation, disabled TLS verification, `alg: none`, `innerHTML`, `Math.random()` for tokens, MD5/SHA-1, CORS `*` with credentials |
| `workflows` | GitHub Actions that paste untrusted text into `run:`, check out a pull request under `pull_request_target`, echo secrets, or follow a branch |
| `hygiene` | Committed `.env` files with readable secrets (encrypted values are fine), key files, a `.gitignore` without `.env`, no lockfile |

```bash
buddy security:scan                          # everything, fail on high or worse
buddy security:scan --only dependencies,secrets --fail-on medium
buddy security:scan --json                   # the report, for tooling
buddy security:scan --show-ignored           # what exceptions set aside
```

A finding that is fine is set aside with a reason, never silently:

- On the line (or the line above): `// security-ignore: code/inner-html the HTML is sanitized by sanitize()`
- In `.security-ignore.json`: `{ "ignore": [{ "rule": "code/sql-interpolation", "path": "database/seed.ts", "reason": "ids from rows it just selected", "expires": "2027-06-30" }] }`. `rule` takes `code/*`; `path` is a file or a directory ending in `/`; for an advisory use `"reference": "GHSA-…"` or the package name. An entry without a reason, or past its `expires`, is reported and no longer applies.

A check that cannot run (offline, no `bun.lock`) is listed under "not checked", never reported as clean. Programmatic use: `import { runSecurityScan } from '@stacksjs/security/scan'`.

## App Key Generation

```typescript
import { generateAppKey } from '@stacksjs/security'

const key = generateAppKey()  // base64: followed by 32 random bytes encoded as base64
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
argon2Encode(value, options?)    // argon2 hash
check(value, hash)               // verifies supported bcrypt/argon2 hashes
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
  // Application rate limits and the login lockout are multiplied by this.
  // Keep 1 in production; tests raise it (or STACKS_RATE_LIMIT_SCALE).
  rateLimit: { scale: 1 },
  // Proxies whose forwarding headers name the client (clientAddress()).
  // Unset = loopback/private/link-local; [] = trust none.
  trustedProxies: ['10.0.0.0/8'],
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
- Default hashing is bcrypt with 12 rounds - sufficient for most applications
- `needsRehash()` compares current hash options against provided options - useful after config changes
- APP_KEY is used for `encrypt()`/`decrypt()` - generate via `buddy key:generate`
- APP_KEY format is colon-separated (validated during deployment)
- Argon2 requires more memory/time but is more resistant to GPU attacks
- Base64 is encoding, not hashing. Never use `base64Encode()` for credentials.
- MD5 and base64 password verification are intentionally absent from the main security API.
- The firewall config is used by cloud deployment for WAF rules
- The firewall rate limit is per-minute per-IP at the WAF (`firewall.rateLimitPerMinute`)
- Application rate limits (`.rateLimit()`, `rateLimit()`, the login lockout) share the Redis cache when it is configured and count per process otherwise; see `stacks-router`


## Encryption and webhook contracts

New `encrypt()` ciphertext uses the versioned AES-256-GCM envelope and
PBKDF2-SHA-256 derivation in `core/security/src/crypt.ts`; decrypt retains
legacy formats for upgrades. The base64: APP_KEY prefix is normalized by that
implementation. Encryption/hashing/encoding are distinct APIs; use the exported
webhook helpers from `core/security/src/webhook.ts` for signed callback
validation rather than inventing a string comparison. To SEND signed webhooks,
`signWebhook(secret | secrets[], body, { timestamp? })` returns the
`t=<unix>,v1=<hex>` header (HMAC-SHA256 of `${t}.${body}`, one `v1` per secret
while rotating) and `verifySignedWebhook` / `verifyWebhook('signed', ...)` is
the receiver's check (tolerance applies both ways). `generateWebhookSecret()`
mints a `whsec_` secret; store it encrypted, since signing needs the plaintext.

Outbound requests to a URL a user typed (webhook endpoints, import-from-URL)
go through `await fetchPublicUrl(url, init?, opts?)`, which makes the request
rather than blessing it: https only, no credentials, every resolved address
public (`isPrivateAddress` covers loopback, RFC 1918, CGNAT, link-local
metadata, IPv4-mapped/NAT64/6to4 forms), **every redirect hop re-checked by
the same rules**, the connection pinned to an address that was checked (name
kept in `Host` and TLS SNI), `Authorization`/`Cookie` dropped across an
origin change, and the body and duration capped. It throws `OutboundUrlError`
with a `reason`.

`outboundUrlProblem(url, opts)` is the cheap check for when the URL is saved,
and `assertPublicOutboundUrl(url, opts)` the check alone. **Checking is not
fetching.** A caller that validates and then calls `fetch` has given the
guarantee back: `fetch` defaults to `redirect: 'follow'`, so a validated host
answering `302 Location: http://169.254.169.254/...` is followed unchecked,
and `fetch` resolves the name a second time, so the address that was approved
is not the address connected to (stacksjs/stacks#2909). Use `fetchPublicUrl`
unless you know you want only the check.
API keys handed to integrations: `generateApiKey('myapp_live_')` returns
`{ key, hash, hint }`; show `key` once, store `hash` (`hashApiKey`), list `hint`.

Configured or user-supplied regex patterns: `matchBoundedRegex(source, input, options)`
accepts optional `flags` and `timeoutMs`, and returns `{ value, index }` for the first complete
match, or `null`. Every call runs in an isolated Bun process with an OS-enforced
deadline and `SIGKILL`, including process startup (25ms by default, integer
1-1000ms). It requires `bun` on PATH. Timeouts throw `RegexTimeoutError`;
invalid patterns throw `SyntaxError`. Do not treat either as a clean security
scan. Source is capped at 8Ki UTF-16 code units, input at 64Ki, and flags at 8.
The helper does not inherit app preloads, environment variables or .env files.
It matches statelessly and does not return captures. Use ordinary RegExp for
trusted application constants to avoid process startup for normal matching.
Timing a synchronous match afterward or vetting one sample input cannot bound
an untrusted expression on its next input.

Generated model API exposure and ownership live under `config/security.ts`
api settings. Read `stacks-models`/`stacks-router` before opening generated
endpoints; a cloud WAF setting does not implement model row authorization.
Capability/config validation and credential recovery have separate tests and
failure contracts; propagate their real errors rather than interpreting an
awaited call as proof that a security state transition persisted.

## Shadowed security defaults

`app/` wins resolution over `storage/framework/defaults/app/`, so an app copy of
a security default freezes that code: framework security fixes to it never run.
The API server (`buddy dev` and `serve`) warns once at boot, and `buddy doctor`
reports a "Security overrides" warning, for every file in
`SECURITY_DEFAULT_FILES` (`@stacksjs/server`) that the app shadows. That list
covers the Auth, Guest, Csrf, Cors, Throttle, Signed, Abilities, Can,
Permission, Role and EnsureEmailIsVerified middleware; the sign-in, session,
token, OAuth, passkey, magic-link, social and session-handoff actions with their
helpers; and the password-reset actions.

- `identical`: a byte-for-byte copy. Delete it, since it does nothing except
  block fixes.
- `modified`: diff it against the current default and port any fixes. Once
  reviewed, add `// stacks-reviewed-default: <fingerprint>` (the warning prints
  the value). The fingerprint is a hash of the default, so the warning comes
  back when the framework changes that default.

Set `STACKS_SHADOWED_DEFAULTS_WARN=false` to silence it. To check
programmatically, call `findShadowedSecurityDefaults(appDir, defaultsDir)`,
which returns `{ path, kind, appFile, defaultFile, fingerprint }[]`. Keep app
hooks in events or app-owned actions rather than copying these files.

## Credential and sign-in hardening

- Social sign-in state is single use, browser bound and stored as a digest
  (`issueOAuthFlow` / `consumeOAuthFlow`, `stacks-socials`); the callback hands
  over a one-use code, never tokens in a URL (`createSessionHandoff`,
  `stacks-auth`).
- Any change to how an account proves who it is runs
  `revokeAccountCredentials()` (`stacks-auth`): stamp, then revoke challenges,
  magic links, OAuth grants, tokens and sessions in one transaction.
- SMS STOP is never bypassed by `ignorePreferences`; only an explicit
  `ignoreOptOut` for legally required messages (`stacks-notifications`).
