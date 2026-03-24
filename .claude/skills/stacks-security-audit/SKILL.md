---
name: stacks-security-audit
description: Use when performing security analysis on a Stacks application — OWASP Top 10, STRIDE threat modeling, attack surface mapping, dependency audit. Requires concrete exploit scenarios. Invoke with /stacks-security-audit.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# /stacks-security-audit — Security Analysis

You are performing a security analysis for a Stacks application. Be concrete — every finding must include a realistic exploit scenario. Vague warnings are worthless.

## Determine Scope

1. If the user specifies files or a feature, analyze that scope
2. Otherwise, analyze: API routes (`routes/`), auth flows (`@stacksjs/auth`), middleware, data handling, config/services.ts

## Step 1: Attack Surface Map

```
## Attack Surface

| Entry Point | Type | Auth Required? | Input Validation |
|-------------|------|----------------|------------------|
| [route/handler] | [HTTP/CLI/WebSocket] | [yes/no] | [description] |
```

For Stacks specifically, check:
- API routes in `routes/api.ts` (136+ routes auto-generated)
- CLI command handlers via `buddy` (command injection via user args)
- WebSocket endpoints (`@stacksjs/realtime`)
- Config file parsing
- Dev server endpoints (`rpx`, `localtunnels` exposure)
- Dashboard routes (auth middleware applied?)
- File upload handling via `EnhancedRequest.file()`

## Step 2: OWASP Top 10

Evaluate each applicable category. **Only report findings with confidence ≥ 8/10.**

For each finding:
1. **The vulnerability** — file:line reference
2. **Exploit scenario** — step-by-step
3. **Impact** — what attacker gains
4. **Confidence** — 1-10
5. **Fix** — concrete code change

```
### [OWASP Category]

🔴 **[Finding]** (Confidence: [N]/10)

**Location**: [file:line]
**Vulnerability**: [what's wrong]

**Exploit scenario**:
1. Attacker does [X]
2. System responds with [Y]
3. Attacker gains [Z]

**Impact**: [specific impact]
**Fix**: [concrete change]
```

### Stacks-Specific Security Checks

- **Auth token handling**: Check `@stacksjs/auth` for token validation, rotation (30d expiry, 7d rotation)
- **Webhook URLs in `config/services.ts`**: Discord, Slack, Stripe keys — are they properly secured?
- **ORM injection**: Check if user input flows unsanitized into query builder `.where()` calls
- **Middleware gaps**: Are admin routes protected by `auth` middleware? Check `routes/api.ts` group middleware
- **Rate limiting**: Is `throttle` middleware applied to auth endpoints?
- **Passkey handling**: Check `@stacksjs/auth` passkey credential storage
- **File uploads**: Check `EnhancedRequest.file()` for path traversal, size limits
- **Maintenance mode bypass**: Check secret URL mechanism in Maintenance middleware

## Step 3: STRIDE Threat Model

| Threat | Question | Finding |
|--------|----------|---------|
| **Spoofing** | Can someone impersonate a user/service? | |
| **Tampering** | Can data be modified in transit/rest? | |
| **Repudiation** | Can actions happen without traces? | |
| **Information Disclosure** | Can unauthorized data be accessed? | |
| **Denial of Service** | Can the system be made unavailable? | |
| **Elevation of Privilege** | Can higher privileges be gained? | |

## Step 4: Dependency Audit

1. Read `package.json` for direct dependencies
2. Check for known vulnerabilities
3. Flag overly permissive version ranges
4. Check dependencies with filesystem/network/child_process access

## Output Format

```
# Security Analysis: [scope]

## Attack Surface
[table]

## Critical Findings (Confidence ≥ 8/10)
[findings sorted by severity]

## STRIDE Assessment
[table]

## Dependency Audit
[findings]

## Lower Confidence Observations
[< 8/10 findings]

## Summary
- Critical findings: [count]
- Risk: [LOW / MEDIUM / HIGH / CRITICAL]
```

## Rules

- **Concrete exploits only.** "Doesn't validate input" is not a finding. Show the exact exploit.
- **8/10 confidence threshold.** False positives erode trust.
- **No theoretical threats.** If the code doesn't handle XML, skip XXE.
- **Never suggest security-through-obscurity.**

## Downstream

> **Security analysis complete.** Run `/stacks-review` to verify fixes against these findings.
