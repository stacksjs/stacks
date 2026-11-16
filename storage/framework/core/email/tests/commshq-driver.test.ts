import { describe, expect, test } from 'bun:test'
import { CommsHqDriver, resolveDefaultMailDriver } from '../src/drivers/commshq'

describe('which mailer an app sends with', () => {
  test('an app that named a mailer keeps it, connected or not', () => {
    expect(resolveDefaultMailDriver({ configured: 'smtp', explicit: true, commshqKey: 'key', environment: 'production' })).toBe('smtp')
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: true, commshqKey: 'key', environment: 'production' })).toBe('log')
  })

  test('a connected app sends through CommsHQ where mail really goes out', () => {
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: false, commshqKey: 'key', environment: 'production' })).toBe('commshq')
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: false, commshqKey: 'key', environment: 'staging' })).toBe('commshq')
  })

  test('a connected app that turned its mail off keeps its own mailer', () => {
    expect(resolveDefaultMailDriver({ configured: 'smtp', explicit: false, commshqKey: 'key', commshqMail: false, environment: 'production' })).toBe('smtp')
    expect(resolveDefaultMailDriver({ configured: 'smtp', explicit: false, commshqKey: 'key', commshqMail: true, environment: 'production' })).toBe('commshq')
  })

  test('a key in a developer\'s .env does not send real mail', () => {
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: false, commshqKey: 'key', environment: 'local' })).toBe('log')
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: false, commshqKey: 'key' })).toBe('log')
  })

  test('an app that is not connected is as it was', () => {
    expect(resolveDefaultMailDriver({ configured: 'log', explicit: false, environment: 'production' })).toBe('log')
    expect(resolveDefaultMailDriver({ explicit: false, environment: 'production' })).toBe('ses')
  })
})

describe('what is posted to CommsHQ', () => {
  const driver = new CommsHqDriver()

  test('the message, with its addresses as lists, a name kept beside its address', () => {
    const body = driver.body({
      from: { name: 'Votescape', address: 'noreply@votescape.org' },
      to: [{ name: 'Reader', address: 'reader@example.com' }],
      cc: 'copy@example.com',
      replyTo: 'hello@votescape.org',
      subject: 'Results',
      text: 'plain',
      idempotencyKey: 'welcome:1',
      headers: { 'X-Campaign': 'launch' },
    }, '<p>html</p>')

    expect(body).toEqual({
      from: { name: 'Votescape', address: 'noreply@votescape.org' },
      to: ['Reader <reader@example.com>'],
      cc: ['copy@example.com'],
      replyTo: ['hello@votescape.org'],
      subject: 'Results',
      html: '<p>html</p>',
      text: 'plain',
      headers: { 'X-Campaign': 'launch' },
      idempotencyKey: 'welcome:1',
    })
  })

  test('nothing empty is sent', () => {
    const body = driver.body({ from: { name: 'A', address: 'a@example.com' }, to: 'b@example.com', subject: 'Hi', text: 'x' }, undefined)
    expect(Object.keys(body).sort()).toEqual(['from', 'subject', 'text', 'to'])
  })
})
