import { isApiRequest, JSON_CONTENT_TYPE } from '../src/api-shape'

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/x', { headers })
}

describe('isApiRequest', () => {
  it('returns true for Content-Type: application/json', () => {
    expect(isApiRequest(req({ 'content-type': 'application/json' }))).toBe(true)
  })

  it('returns true for application/json; charset=utf-8', () => {
    expect(isApiRequest(req({ 'content-type': 'application/json; charset=utf-8' }))).toBe(true)
  })

  it('returns true for application/vnd.api+json (structured suffix)', () => {
    expect(isApiRequest(req({ 'content-type': 'application/vnd.api+json' }))).toBe(true)
  })

  it('returns true for application/ld+json', () => {
    expect(isApiRequest(req({ 'content-type': 'application/ld+json' }))).toBe(true)
  })

  it('returns true for application/problem+json', () => {
    expect(isApiRequest(req({ 'content-type': 'application/problem+json' }))).toBe(true)
  })

  it('returns true with no headers at all (most HTTP libs default)', () => {
    expect(isApiRequest(req({}))).toBe(true)
  })

  it('returns true for Accept: */* (fetch / curl default)', () => {
    expect(isApiRequest(req({ accept: '*/*' }))).toBe(true)
  })

  it('returns true for Accept: application/json', () => {
    expect(isApiRequest(req({ accept: 'application/json' }))).toBe(true)
  })

  it('returns false for browser nav Accept header', () => {
    expect(isApiRequest(req({
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }))).toBe(false)
  })

  it('returns false for Sec-Fetch-Dest: document (top-level nav)', () => {
    expect(isApiRequest(req({ 'sec-fetch-dest': 'document', 'accept': '*/*' }))).toBe(false)
  })

  it('Sec-Fetch-Dest: document beats application/json Content-Type', () => {
    // Defensive: Content-Type wins per spec order (JSON body must be parsed),
    // but a top-level doc navigation shouldn't be sending JSON bodies anyway.
    // Document the precedence: Content-Type check happens first.
    expect(isApiRequest(req({
      'sec-fetch-dest': 'document',
      'content-type': 'application/json',
    }))).toBe(true)
  })

  it('returns true for Sec-Fetch-Dest: empty (fetch from JS)', () => {
    expect(isApiRequest(req({ 'sec-fetch-dest': 'empty', 'accept': '*/*' }))).toBe(true)
  })

  it('returns false when Accept lists text/html alongside other types', () => {
    // Even a wildcard-anything Accept with text/html in the mix is the
    // browser-nav fingerprint, not an API client.
    expect(isApiRequest(req({ accept: 'text/html,*/*' }))).toBe(false)
  })

  it('text/plain Content-Type with no Accept → still JSON (no HTML signal)', () => {
    expect(isApiRequest(req({ 'content-type': 'text/plain' }))).toBe(true)
  })
})

describe('JSON_CONTENT_TYPE regex', () => {
  it.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['APPLICATION/JSON', true],
    ['application/vnd.api+json', true],
    ['application/ld+json', true],
    ['application/hal+json', true],
    ['application/problem+json; charset=utf-8', true],
    ['text/json', false],
    ['application/jsonp', false],
    ['application/x-json', false],
    ['text/html', false],
    ['', false],
  ])('%s → %s', (input, expected) => {
    expect(JSON_CONTENT_TYPE.test(input)).toBe(expected)
  })
})
