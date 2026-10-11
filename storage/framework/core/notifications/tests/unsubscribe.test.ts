import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'

const { notificationUnsubscribeLinks, notificationUnsubscribeToken, parseNotificationUnsubscribeToken, unsubscribeTokenFromRequest } = await import('../src/unsubscribe')

const saved = { key: process.env.APP_KEY, url: process.env.APP_URL }
beforeEach(() => {
  process.env.APP_KEY = 'test-key-0123456789abcdef'
  process.env.APP_URL = 'https://app.test/'
})
afterEach(() => {
  for (const [name, value] of [['APP_KEY', saved.key], ['APP_URL', saved.url]] as const) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('notification unsubscribe tokens', () => {
  test('round-trip the user, channel and category', () => {
    expect(parseNotificationUnsubscribeToken(notificationUnsubscribeToken(42, 'email'))).toEqual({ userId: 42, channel: 'email', category: 'marketing' })
    expect(parseNotificationUnsubscribeToken(notificationUnsubscribeToken(7, 'sms', 'news'))).toEqual({ userId: 7, channel: 'sms', category: 'news' })
  })

  test('keep the {userId}:{channel}:{category}:{hmac} format, so links already sent keep working', () => {
    const decoded = Buffer.from(notificationUnsubscribeToken(42, 'email'), 'base64url').toString('utf8')
    expect(decoded).toMatch(/^42:email:marketing:[0-9a-f]{64}$/)
  })

  test('reject tampering, another key, unsupported channels and non-canonical spellings', () => {
    const token = notificationUnsubscribeToken(42, 'email')
    expect(parseNotificationUnsubscribeToken(`${token}x`)).toBeNull()
    expect(parseNotificationUnsubscribeToken(Buffer.from('43:email:marketing:' + '0'.repeat(64)).toString('base64url'))).toBeNull()
    expect(parseNotificationUnsubscribeToken(Buffer.from('42:push:marketing:bad').toString('base64url'))).toBeNull()
    expect(parseNotificationUnsubscribeToken('')).toBeNull()
    process.env.APP_KEY = 'another-key-0123456789abcdef'
    expect(parseNotificationUnsubscribeToken(token)).toBeNull()
  })

  test('refuse to sign without APP_KEY in production', () => {
    const env = process.env.APP_ENV
    delete process.env.APP_KEY
    process.env.APP_ENV = 'production'
    try { expect(() => notificationUnsubscribeToken(42, 'email')).toThrow('APP_KEY') }
    finally {
      if (env === undefined) delete process.env.APP_ENV
      else process.env.APP_ENV = env
    }
  })
})

describe('notificationUnsubscribeLinks', () => {
  test('builds the page, one-click and preferences links from APP_URL', () => {
    const token = notificationUnsubscribeToken(42, 'email')
    expect(notificationUnsubscribeLinks(42, { notice: 'Why' })).toEqual({
      url: `https://app.test/unsubscribe?token=${token}`,
      oneClickUrl: `https://app.test/api/notifications/unsubscribe?token=${token}`,
      preferencesUrl: 'https://app.test/settings',
      notice: 'Why',
    })
    expect(notificationUnsubscribeLinks(42, { preferencesPath: false, baseUrl: 'https://x.test', pagePath: 'bye' }).url).toBe(`https://x.test/bye?token=${token}`)
  })
})

describe('unsubscribeTokenFromRequest', () => {
  test('reads a one-click POST\'s query string first, then a JSON body', async () => {
    expect(await unsubscribeTokenFromRequest({ url: 'https://app.test/api/notifications/unsubscribe?token=abc', json: async () => ({ token: 'ignored' }) })).toBe('abc')
    expect(await unsubscribeTokenFromRequest({ url: '/api/notifications/unsubscribe', json: async () => ({ token: 'def' }) })).toBe('def')
    expect(await unsubscribeTokenFromRequest({ url: '/api/notifications/unsubscribe', json: async () => { throw new Error('form body') } })).toBe('')
  })
})
