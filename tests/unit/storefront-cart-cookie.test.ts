import { describe, expect, it } from 'bun:test'
import { cartTokenFromRequest, cookieFromRequest } from '../../storage/framework/defaults/resources/functions/storefront/cart-cookie'

const withCookie = (value: string) => new Request('https://shop.test/cart', { headers: { cookie: value } })

describe('cookieFromRequest', () => {
  it('reads a named cookie', () => {
    expect(cartTokenFromRequest(withCookie('stacks_cart=abc123'))).toBe('abc123')
  })
  it('reads it from the middle of a list', () => {
    expect(cartTokenFromRequest(withCookie('a=1; stacks_cart=abc123; b=2'))).toBe('abc123')
  })
  it('decodes a percent-encoded value', () => {
    expect(cartTokenFromRequest(withCookie('stacks_cart=a%2Fb'))).toBe('a/b')
  })
  it('returns the raw value when the encoding is malformed', () => {
    expect(cartTokenFromRequest(withCookie('stacks_cart=%E0%A4%A'))).toBe('%E0%A4%A')
  })
  it('does not match a cookie whose name merely ends with the one asked for', () => {
    expect(cartTokenFromRequest(withCookie('other_stacks_cart=nope'))).toBeNull()
  })
  it('returns null with no cookie header, no request, or no match', () => {
    expect(cartTokenFromRequest(new Request('https://shop.test/cart'))).toBeNull()
    expect(cartTokenFromRequest(undefined)).toBeNull()
    expect(cookieFromRequest(withCookie('a=1'), 'stacks_cart')).toBeNull()
  })
})
