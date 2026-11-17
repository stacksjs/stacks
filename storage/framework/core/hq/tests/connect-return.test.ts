import { describe, expect, test } from 'bun:test'
import { connectPath, connectReturn, withConnectReturn } from '../src/connect-return'

/**
 * Signing in during `buddy hq:connect` comes back to the approve page.
 *
 * A signed-out person who opened the approve link used to be sent to sign in,
 * landed where sign-in always lands, and the connect was lost: the terminal
 * waited for a confirmation nobody was asked for.
 */

const CODE = 'T-7-D_wNoBcWEsXJYgHokh4DB4GtngYPGzdFVM11amk'
const APPROVE = `/cli/connect?code=${CODE}`

describe('the return to the connect approve page', () => {
  test('is the approve page with its code', () => {
    expect(connectPath(CODE)).toBe(APPROVE)
    expect(connectReturn(APPROVE)).toBe(APPROVE)
    expect(withConnectReturn('/login', CODE)).toBe(`/login?next=${encodeURIComponent(APPROVE)}`)
    expect(withConnectReturn('/register', CODE)).toBe(`/register?next=${encodeURIComponent(APPROVE)}`)
  })

  test('survives the trip through the sign-in link and back', () => {
    const link = new URL(withConnectReturn('/login', CODE), 'https://app.test')
    expect(connectReturn(link.searchParams.get('next'))).toBe(APPROVE)
  })

  test('is nothing for a code that is not one, so the link is the plain page', () => {
    for (const code of [undefined, null, '', 'short', 'bad code', `${CODE}&next=//evil.example`, `${CODE}#x`, 'a'.repeat(129)]) {
      expect(connectPath(code)).toBe('')
      expect(withConnectReturn('/login', code)).toBe('/login')
    }
  })

  test('follows nothing that only looks like the approve page', () => {
    for (const next of [
      undefined, null, '', '/dashboard', '/cli/connect', '/cli/connect?code=short',
      `/cli/connect?code=${CODE}&next=https://evil.example`,
      `https://evil.example/cli/connect?code=${CODE}`,
      `//evil.example/cli/connect?code=${CODE}`,
      `/cli/connect?code=${CODE}#x`,
      `/cli/connect/../login?code=${CODE}`,
      ` /cli/connect?code=${CODE}`,
      `/cli/connect?code=${CODE}\n`,
      'javascript:alert(1)',
    ])
      expect(connectReturn(next)).toBe('')
  })

  test('takes only the first value of a repeated parameter', () => {
    expect(connectReturn([APPROVE, 'https://evil.example'])).toBe(APPROVE)
    expect(connectReturn(['https://evil.example', APPROVE])).toBe('')
  })
})
