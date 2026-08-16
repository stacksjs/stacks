import { describe, expect, it } from 'bun:test'
import { classifyAgent, isPageviewRequest, referrerHost } from '../src/capture'

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

function headers(init: Record<string, string> = {}): Headers {
  return new Headers({ 'user-agent': CHROME, 'accept': 'text/html,application/xhtml+xml', ...init })
}

describe('isPageviewRequest', () => {
  it('counts navigations, excludes assets, api, bots and no-agent', () => {
    expect(isPageviewRequest('GET', '/events/spring-gala', headers())).toBe(true)
    expect(isPageviewRequest('GET', '/', headers())).toBe(true)

    expect(isPageviewRequest('POST', '/events', headers())).toBe(false)
    expect(isPageviewRequest('GET', '/app.css', headers())).toBe(false)
    expect(isPageviewRequest('GET', '/img/hero.webp', headers())).toBe(false)
    expect(isPageviewRequest('GET', '/api/campushq/events', headers())).toBe(false)
    expect(isPageviewRequest('GET', '/__deps/icons.css', headers())).toBe(false)
    expect(isPageviewRequest('GET', '/x', headers({ 'user-agent': 'Googlebot/2.1' }))).toBe(false)
    expect(isPageviewRequest('GET', '/x', headers({ 'user-agent': 'curl/8.0' }))).toBe(false)
    expect(isPageviewRequest('GET', '/x', new Headers({ accept: 'text/html' }))).toBe(false)
    expect(isPageviewRequest('GET', '/x', headers({ accept: 'application/json' }))).toBe(false)
  })
})

describe('classifyAgent', () => {
  it('coarse device + browser only', () => {
    expect(classifyAgent(CHROME)).toEqual({ device: 'desktop', browser: 'chrome' })
    expect(classifyAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'safari' })
    expect(classifyAgent('Mozilla/5.0 (Windows NT 10.0) Gecko Firefox/128.0')).toEqual({ device: 'desktop', browser: 'firefox' })
  })
})

describe('referrerHost', () => {
  it('external hosts only; self and garbage are null', () => {
    expect(referrerHost('https://www.google.com/search?q=x', 'campushq.stacksjs.com')).toBe('www.google.com')
    expect(referrerHost('https://campushq.stacksjs.com/events', 'campushq.stacksjs.com')).toBeNull()
    expect(referrerHost('not a url', 'x')).toBeNull()
    expect(referrerHost(null, 'x')).toBeNull()
  })
})
