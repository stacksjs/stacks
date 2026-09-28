import { describe, expect, it } from 'bun:test'
import {
  OAuthAuthorizationConsentRequestError,
  parseOAuthAuthorizationConsentRequest,
} from '../src/oauth-consent'

function captureError(body: string): OAuthAuthorizationConsentRequestError {
  try {
    parseOAuthAuthorizationConsentRequest(body)
    throw new Error('Expected OAuth consent parsing to fail.')
  }
  catch (error) {
    expect(error).toBeInstanceOf(OAuthAuthorizationConsentRequestError)
    return error as OAuthAuthorizationConsentRequestError
  }
}

describe('OAuth authorization consent request parsing', () => {
  it('returns only the opaque request handle and decision', () => {
    const parsed = parseOAuthAuthorizationConsentRequest(new URLSearchParams({
      request_id: 'a'.repeat(43),
      decision: 'approve',
      _token: 'csrf-is-verified-by-route-middleware',
      redirect_uri: 'https://attacker.example/callback',
      subject_id: '999',
    }))

    expect(parsed).toEqual({ requestId: 'a'.repeat(43), decision: 'approve' })
    expect('redirectUri' in parsed).toBeFalse()
    expect('subjectId' in parsed).toBeFalse()
  })

  it('accepts denial as the only other decision', () => {
    expect(parseOAuthAuthorizationConsentRequest(new URLSearchParams({
      request_id: 'b'.repeat(43),
      decision: 'deny',
    }))).toEqual({ requestId: 'b'.repeat(43), decision: 'deny' })
  })

  it('rejects repeated, malformed, or oversized input', () => {
    for (const name of ['request_id', 'decision']) {
      const body = new URLSearchParams({ request_id: 'c'.repeat(43), decision: 'approve' })
      body.append(name, 'duplicate')
      expect(captureError(body.toString()).code).toBe('invalid_request')
    }
    expect(captureError('request_id=short&decision=approve').code).toBe('invalid_request')
    expect(captureError(`request_id=${'d'.repeat(43)}&decision=maybe`).code).toBe('invalid_request')
    expect(captureError(`padding=${'x'.repeat(4097)}`).code).toBe('invalid_request')
  })
})
