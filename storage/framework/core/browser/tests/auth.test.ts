/**
 * stacksjs/status#1 — LoginAction/RegisterAction/AuthUserAction respond via
 * `response.json({...})`, which serializes flat (no `{ data: ... }`
 * envelope). useAuth() previously read `data.data.token` /
 * `data.user` for the /me response, which meant every successful login or
 * register through the default dashboard silently stored `token.value =
 * undefined`. These tests pin the composable to the actual flat wire shape.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useAuth } from '../src/composables/useAuth'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useAuth response envelope', () => {
  let originalFetch: typeof fetch
  let originalRaf: typeof requestAnimationFrame | undefined

  beforeEach(() => {
    originalFetch = globalThis.fetch
    // @stacksjs/stx's reactivity schedules via requestAnimationFrame, which
    // isn't polyfilled in Bun's non-DOM test environment.
    originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.requestAnimationFrame = originalRaf as any
  })

  it('login() stores the flat `token` field LoginAction actually returns', async () => {
    globalThis.fetch = (async () => jsonResponse({
      access_token: 'access-abc',
      refresh_token: 'refresh-abc',
      token_type: 'Bearer',
      expires_in: 3600,
      token: 'access-abc',
      user: { id: 1, email: 'a@example.com', name: 'A' },
    })) as typeof fetch

    const { login, token } = useAuth()
    const result = await login({ email: 'a@example.com', password: 'secretpw' })

    expect(result && 'errors' in result).toBe(false)
    expect(token.value).toBe('access-abc')
  })

  it('register() stores the flat `token` field RegisterAction actually returns', async () => {
    globalThis.fetch = (async () => jsonResponse({
      token: 'register-token',
      user: { id: 2, email: 'c@example.com', name: 'C' },
    })) as typeof fetch

    const { register, token } = useAuth()
    const result = await register({ email: 'c@example.com', password: 'secretpw', name: 'C' } as any)

    expect(result && 'errors' in result).toBe(false)
    expect(token.value).toBe('register-token')
  })

  it('fetchAuthUser() reads the flat user object AuthUserAction actually returns', async () => {
    globalThis.fetch = (async () => jsonResponse({ id: 3, email: 'e@example.com', name: 'E' })) as typeof fetch

    const { fetchAuthUser, user } = useAuth()
    const result = await fetchAuthUser()

    expect(result).toEqual({ id: 3, email: 'e@example.com', name: 'E' })
    expect(user.value).toEqual({ id: 3, email: 'e@example.com', name: 'E' })
  })
})

// `storage/framework/defaults/functions/auth.ts` is userland-copied into
// every generated app (same reasoning as
// core/auth/tests/two-factor-login-wiring.test.ts), so it's checked as a
// source pattern here rather than live-imported.
describe('defaults/functions/auth.ts stays off the `.data.` envelope', () => {
  const DEFAULTS_ROOT = resolve(__dirname, '../../../defaults')

  it('reads token/user fields flat, not through a `.data` wrapper', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'functions/auth.ts'), 'utf-8')

    expect(source).not.toMatch(/\.data\.token/)
    expect(source).toMatch(/token\.value = data\.token/)
    expect(source).toMatch(/const data = await response\.json\(\) as MeResponse\s*\n\s*user\.value = data/)
  })

  it('dashboard.ts types declare the flat shape LoginAction/RegisterAction/AuthUserAction return', () => {
    const source = readFileSync(resolve(DEFAULTS_ROOT, 'types/dashboard.ts'), 'utf-8')

    expect(source).not.toMatch(/export type MeResponse = \{[^}]*data/)
    expect(source).toMatch(/export type MeResponse = UserData/)
    expect(source).not.toMatch(/export interface RegisterResponse \{\s*data:/)
  })
})
