import { describe, expect, test } from 'bun:test'

const { emailParagraphs, listUnsubscribeHeaders, notificationEmailHtml, notificationEmailMessage, notificationEmailText, notificationSmsBody } = await import('../src/email-body')

describe('emailParagraphs', () => {
  test('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(emailParagraphs('First line\nsecond line\n\nNext paragraph')).toEqual([
      [{ text: 'First line' }, { br: true }, { text: 'second line' }],
      [{ text: 'Next paragraph' }],
    ])
  })

  test('turns addresses into links without the punctuation after them', () => {
    expect(emailParagraphs('Open https://hq.training/m/workout/7. Thanks')).toEqual([
      [{ text: 'Open ' }, { url: 'https://hq.training/m/workout/7' }, { text: '. Thanks' }],
    ])
  })

  test('drops empty paragraphs and normalises Windows line endings', () => {
    expect(emailParagraphs('\r\n\r\nOne\r\n\r\n\r\n')).toEqual([[{ text: 'One' }]])
  })
})

describe('notificationEmailHtml', () => {
  test('renders the notification template, escaped, with the action as a button', async () => {
    const html = await notificationEmailHtml({
      subject: 'Coach commented',
      body: 'Nice <3 & well done\n\nSee https://example.com/w/1',
      action: { label: 'Open the workout', url: 'https://example.com/w/1' },
    })
    expect(html).toContain('<!DOCTYPE html')
    expect(html).toContain('Coach commented')
    expect(html).toContain('Nice &lt;3 &amp; well done')
    expect(html).toContain('href="https://example.com/w/1"')
    expect(html).toContain('Open the workout')
    expect(html).not.toMatch(/@foreach|@if|\{\{/)
  })

  test('leaves the button out when there is no action', async () => {
    const html = await notificationEmailHtml({ subject: 'Hello', body: 'Just text' })
    expect(html).toContain('Just text')
    expect(html).not.toContain('>Open<')
  })
})

describe('notificationEmailText', () => {
  test('spells out the action link in the plain-text part', () => {
    expect(notificationEmailText({ body: 'Body', action: { label: 'Open', url: 'https://x.test/a' } })).toBe('Body\n\nOpen: https://x.test/a')
    expect(notificationEmailText({ body: 'Body' })).toBe('Body')
  })
})

describe('unsubscribe links in notification emails', () => {
  const unsubscribe = {
    url: 'https://app.test/unsubscribe?token=abc',
    oneClickUrl: 'https://app.test/api/notifications/unsubscribe?token=abc',
    preferencesUrl: 'https://app.test/settings',
    notice: 'You get these because marketing email is on.',
  }

  test('puts the notice and links in the footer instead of "do not reply"', async () => {
    const html = await notificationEmailHtml({ subject: 'Summer hours', body: 'Open at 6.', unsubscribe })
    expect(html).toContain('You get these because marketing email is on.')
    expect(html).toContain('href="https://app.test/unsubscribe?token=abc"')
    expect(html).toContain('>Unsubscribe</a>')
    expect(html).toContain('href="https://app.test/settings"')
    expect(html).not.toContain('Please do not reply')
    expect(html).not.toMatch(/@foreach|@if|\{\{/)
  })

  test('keeps the transactional footer when there is no unsubscribe', async () => {
    const html = await notificationEmailHtml({ subject: 'Receipt', body: 'Paid.' })
    expect(html).toContain('Please do not reply')
    expect(html).not.toContain('>Unsubscribe</a>')
  })

  test('spells the link out in the plain-text part', () => {
    expect(notificationEmailText({ body: 'Open at 6.', unsubscribe })).toBe('Open at 6.\n\nYou get these because marketing email is on.\nUnsubscribe: https://app.test/unsubscribe?token=abc')
  })

  test('sets one-click List-Unsubscribe headers (RFC 8058)', () => {
    expect(listUnsubscribeHeaders(unsubscribe)).toEqual({
      'List-Unsubscribe': '<https://app.test/api/notifications/unsubscribe?token=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    // Without a one-click endpoint, the header points at the page and makes no one-click claim.
    expect(listUnsubscribeHeaders({ url: 'https://app.test/u' })).toEqual({ 'List-Unsubscribe': '<https://app.test/u>' })
    expect(listUnsubscribeHeaders()).toEqual({})
  })

  test('builds the whole message, merging the payload\'s own headers', async () => {
    const message = await notificationEmailMessage('a@app.test', { subject: 'Hi', body: 'Body', unsubscribe, headers: { 'X-Campaign': 'summer' } })
    expect(message.to).toBe('a@app.test')
    expect(message.headers).toEqual({
      'X-Campaign': 'summer',
      'List-Unsubscribe': '<https://app.test/api/notifications/unsubscribe?token=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect((await notificationEmailMessage('a@app.test', { body: 'Body' })).headers).toBeUndefined()
  })
})

describe('notificationSmsBody', () => {
  test('ends a marketing text with the opt-out line', () => {
    expect(notificationSmsBody({ body: 'Pool closed Friday.\n' }, 'marketing')).toBe('Pool closed Friday.\n\nReply STOP to opt out.')
  })

  test('leaves other texts alone, and honours an explicit line or false', () => {
    expect(notificationSmsBody({ body: 'Your code is 123' }, 'transactional')).toBe('Your code is 123')
    expect(notificationSmsBody({ body: 'Sale', smsOptOut: 'Text STOP to quit' })).toBe('Sale\n\nText STOP to quit')
    expect(notificationSmsBody({ body: 'Sale', smsOptOut: false }, 'marketing')).toBe('Sale')
  })

  test('does not repeat a line the body already has', () => {
    expect(notificationSmsBody({ body: 'Sale. Reply STOP to opt out.' }, 'marketing')).toBe('Sale. Reply STOP to opt out.')
  })
})
