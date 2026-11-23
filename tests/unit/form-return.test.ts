import { describe, expect, test } from 'bun:test'
import { formReturnLocation, normalizeEmail, wantsFormRedirect } from '../../storage/framework/defaults/app/Actions/form-return'

describe('wantsFormRedirect', () => {
  const headers = (accept: string, type: string) => new Headers({ 'accept': accept, 'content-type': type })

  test('a browser submitting a form gets sent back to the page', () => {
    expect(wantsFormRedirect(headers('text/html,application/xhtml+xml,*/*;q=0.8', 'application/x-www-form-urlencoded'))).toBe(true)
    expect(wantsFormRedirect(headers('text/html', 'multipart/form-data; boundary=x'))).toBe(true)
  })

  test('a script keeps getting JSON', () => {
    // fetch() sends Accept: */* unless told otherwise, even with a form body.
    expect(wantsFormRedirect(headers('*/*', 'application/x-www-form-urlencoded'))).toBe(false)
    expect(wantsFormRedirect(headers('application/json', 'application/json'))).toBe(false)
    expect(wantsFormRedirect(headers('text/html', 'application/json'))).toBe(false)
  })
})

describe('formReturnLocation', () => {
  const back = (target: unknown, referer: string | null = null) =>
    formReturnLocation({ target, referer, param: 'subscribe', outcome: 'subscribed' })

  test('goes back to the path the form names, keeping its fragment', () => {
    expect(back('/blog/introducing-stacks#subscribe')).toBe('/blog/introducing-stacks?subscribe=subscribed#subscribe')
    expect(back('/#subscribe')).toBe('/?subscribe=subscribed#subscribe')
  })

  test('replaces an earlier outcome rather than stacking them', () => {
    expect(back('/blog?subscribe=invalid#subscribe')).toBe('/blog?subscribe=subscribed#subscribe')
    expect(back('/blog?ref=x')).toBe('/blog?ref=x&subscribe=subscribed')
  })

  test('falls back to the referring page, then home', () => {
    expect(back(undefined, 'https://stacksjs.com/blog/the-road-to-v1')).toBe('/blog/the-road-to-v1?subscribe=subscribed')
    expect(back('', null)).toBe('/?subscribe=subscribed')
    expect(back(undefined, 'not a url')).toBe('/?subscribe=subscribed')
  })

  test('never sends the browser to another site', () => {
    for (const target of ['https://evil.example/x', '//evil.example/x', '/\\evil.example/x', 'evil.example', 'javascript:alert(1)', '/ok\r\nSet-Cookie: x=1']) {
      const location = back(target, 'https://stacksjs.com/blog')
      expect(location.startsWith('/blog?')).toBe(true)
    }

    // A referer only ever contributes its path, never its host.
    expect(back(undefined, 'https://evil.example/landing')).toBe('/landing?subscribe=subscribed')
  })
})

describe('normalizeEmail', () => {
  test('one address however it is typed', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com')
    expect(normalizeEmail('first.last+tag@sub.example.co.uk')).toBe('first.last+tag@sub.example.co.uk')
  })

  test('refuses what is not an address', () => {
    for (const value of ['', 'bogus', 'a@b', '@example.com', 'a@@example.com', 'a b@example.com', '<b>@example.com', 'a@example.com<script>', 'a@example.c', undefined, 42, null])
      expect(normalizeEmail(value)).toBeNull()

    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull()
  })
})
