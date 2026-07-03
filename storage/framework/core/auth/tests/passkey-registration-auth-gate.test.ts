/**
 * Passkey ENROLLMENT (attaching a new WebAuthn credential to an
 * account) must be auth-gated. GenerateRegistrationAction and
 * VerifyRegistrationAction previously derived the target account from
 * a client-supplied `email` field on a completely unauthenticated
 * route: anyone who knew a victim's email could register a passkey
 * against that victim's account and log in as them, no password
 * required. The fix derives identity from the caller's own
 * authenticated session (`request.user()`) and gates both routes
 * behind `middleware('auth')` — see stacksjs/status#1 Phase 9.
 *
 * Passkey AUTHENTICATION (logging in) stays unauthenticated on
 * purpose — the caller doesn't have a session yet.
 *
 * Same test-without-cross-package-import pattern as
 * logout-all.test.ts: these actions live in defaults/app/Actions
 * (userland-copied, not a core package), so this is a source/wiring
 * check rather than a live handler invocation.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULTS_ROOT = resolve(__dirname, '../../../defaults')

describe('passkey registration auth gate', () => {
  test('GenerateRegistrationAction derives identity from request.user(), not a client-supplied email', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/GenerateRegistrationAction.ts'), 'utf-8')
    expect(source).toMatch(/const user = await request\.user\(\)/)
    expect(source).not.toMatch(/User\.where\('email',\s*email\)/)
    expect(source).not.toMatch(/const email = request\.get\('email'\)/)
  })

  test('VerifyRegistrationAction derives identity from request.user(), not a client-supplied email', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'app/Actions/Auth/VerifyRegistrationAction.ts'), 'utf-8')
    expect(source).toMatch(/const user = await request\.user\(\)/)
    expect(source).not.toMatch(/User\.where\('email',\s*email\)/)
    expect(source).not.toMatch(/const email = request\.get\('email'\)/)
  })

  test('routes/dashboard.ts gates both registration routes behind middleware(\'auth\')', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'routes/dashboard.ts'), 'utf-8')

    const genLine = source.split('\n').find(l => l.includes('generate-registration-options'))
    const verifyLine = source.split('\n').find(l => l.includes('/verify-registration'))

    expect(genLine).toBeTruthy()
    expect(verifyLine).toBeTruthy()
    expect(genLine).toMatch(/\.middleware\('auth'\)/)
    expect(verifyLine).toMatch(/\.middleware\('auth'\)/)
  })

  test('passkey AUTHENTICATION (login) routes remain unauthenticated', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'routes/dashboard.ts'), 'utf-8')

    const genAuthLine = source.split('\n').find(l => l.includes('generate-authentication-options'))
    const verifyAuthLine = source.split('\n').find(l => l.includes('/verify-authentication'))

    expect(genAuthLine).toBeTruthy()
    expect(verifyAuthLine).toBeTruthy()
    // These run before the caller has a session — gating them behind
    // auth would make login impossible.
    expect(genAuthLine).not.toMatch(/\.middleware\('auth'\)/)
    expect(verifyAuthLine).not.toMatch(/\.middleware\('auth'\)/)
  })
})
