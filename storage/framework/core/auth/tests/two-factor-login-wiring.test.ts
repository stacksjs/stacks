/**
 * stacksjs/status#1 Phase 9 — source/wiring checks that LoginAction and
 * VerifyTwoFactorLoginAction are actually connected to the two-factor.ts
 * challenge primitives. Same cross-package-avoidance rationale as
 * passkey-registration-auth-gate.test.ts: these actions live in
 * defaults/app/Actions (userland-copied), so this is a source check
 * rather than a live handler invocation; the primitives themselves are
 * covered behaviorally in two-factor.test.ts.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULTS_ROOT = resolve(__dirname, '../../../defaults')

describe('TOTP login-challenge wiring', () => {
  test('LoginAction verifies credentials before minting tokens, branches on 2FA', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/LoginAction.ts'), 'utf-8')
    expect(source).toMatch(/await Auth\.attempt\(\{ email, password \}\)/)
    expect(source).toMatch(/getTwoFactorState\(authedUser\.id as number\)/)
    expect(source).toMatch(/createTwoFactorChallenge\(authedUser\.id as number\)/)
    expect(source).toMatch(/requires_two_factor: true/)
    // Tokens only get minted via loginUsingId, on the non-2FA path.
    expect(source).toMatch(/Auth\.loginUsingId\(authedUser\.id as number\)/)
  })

  test('VerifyTwoFactorLoginAction consumes the challenge once and verifies the code before minting tokens', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/VerifyTwoFactorLoginAction.ts'), 'utf-8')
    expect(source).toMatch(/consumeTwoFactorChallenge\(challengeToken\)/)
    expect(source).toMatch(/verifyTwoFactorLoginCode\(userId, code\)/)
    expect(source).toMatch(/Auth\.loginUsingId\(userId\)/)
  })

  test('setup Actions never trust a client-supplied secret', () => {
    const generateSource = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/GenerateTwoFactorSecretAction.ts'), 'utf-8')
    const enableSource = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/EnableTwoFactorAction.ts'), 'utf-8')

    expect(generateSource).toMatch(/stashPendingTwoFactorSecret\(user\.id as number, secret\)/)
    expect(enableSource).toMatch(/consumePendingTwoFactorSecret\(user\.id as number\)/)
    expect(enableSource).not.toMatch(/request\.get\('secret'\)/)
  })

  test('routes/dashboard.ts gates setup/enable/disable behind auth, leaves verify-two-factor-login open', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'routes/dashboard.ts'), 'utf-8')
    const lines = source.split('\n')

    const setupLine = lines.find(l => l.includes('generate-two-factor-secret'))
    const enableLine = lines.find(l => l.includes('/enable-two-factor'))
    const disableLine = lines.find(l => l.includes('/disable-two-factor'))
    const verifyLoginLine = lines.find(l => l.includes('/verify-two-factor-login'))

    expect(setupLine).toMatch(/\.middleware\('auth'\)/)
    expect(enableLine).toMatch(/\.middleware\('auth'\)/)
    expect(disableLine).toMatch(/\.middleware\('auth'\)/)
    // The caller only has a challenge token at this point, not a
    // session — gating this behind auth would make 2FA login impossible.
    expect(verifyLoginLine).not.toMatch(/\.middleware\('auth'\)/)
  })
})
