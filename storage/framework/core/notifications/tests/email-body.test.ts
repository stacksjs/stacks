import { describe, expect, test } from 'bun:test'

const { emailParagraphs, listUnsubscribeHeaders, notificationEmailHtml, notificationEmailMessage, notificationEmailText, notificationSmsBody, smsSenderPrefix } = await import('../src/email-body')

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
  test('uses a named email template and its data while preserving the notification subject', async () => {
    const message = await notificationEmailMessage('athlete@example.com', {
      subject: 'Your training is ready', body: 'Plain summary with https://example.com/workout/7',
      emailTemplate: { name: 'welcome', variables: { userName: '<Chris>', subject: 'Must not replace the subject' } },
    })
    expect(message.html).toContain('Hi &lt;Chris&gt;,')
    expect(message.html).toContain('<title>Your training is ready</title>')
    expect(message.html).not.toContain('Must not replace the subject')
    expect(message.text).toBe('Plain summary with https://example.com/workout/7')
  })

  test('template data cannot replace the shared notification frame or opt-out links', async () => {
    const html = await notificationEmailHtml({
      subject: 'Plan', body: 'Saved plan', locale: 'de',
      unsubscribe: { url: 'https://example.com/unsubscribe' },
      emailTemplate: { name: 'notification', variables: { lang: 'en', paragraphs: [[{ text: 'Wrong body' }]], unsubscribeUrl: 'https://example.com/wrong' } },
    })
    expect(html).toContain('<html lang="de">')
    expect(html).toContain('Saved plan')
    expect(html).toContain('href="https://example.com/unsubscribe"')
    expect(html).not.toContain('Wrong body')
    expect(html).not.toContain('https://example.com/wrong')
  })

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

describe('SMS sender prefix', () => {
  test('starts the text with who it is from, before the opt-out line', () => {
    expect(notificationSmsBody({ body: 'Pool closed Friday.', smsSender: 'TriFit Gym' }, 'marketing')).toBe('TriFit Gym: Pool closed Friday.\n\nReply STOP to opt out.')
    expect(notificationSmsBody({ body: '  Your class is confirmed.', smsSender: 'TriFit Gym' }, 'transactional')).toBe('TriFit Gym: Your class is confirmed.')
  })

  test('does not repeat a name the body already starts with, and adds nothing without one', () => {
    expect(notificationSmsBody({ body: 'TriFit Gym: Pool closed.', smsSender: 'TriFit Gym' })).toBe('TriFit Gym: Pool closed.')
    expect(notificationSmsBody({ body: 'Pool closed.', smsSender: '  ' })).toBe('Pool closed.')
    expect(notificationSmsBody({ body: 'Pool closed.' })).toBe('Pool closed.')
  })

  test('collapses whitespace and cuts a long name at 30 characters, without an ellipsis', () => {
    expect(smsSenderPrefix('  North   Shore  Strength ')).toBe('North Shore Strength: ')
    expect(smsSenderPrefix('The Extremely Long Strength and Conditioning Collective')).toBe('The Extremely Long Strength an: ')
    expect(smsSenderPrefix(undefined)).toBe('')
  })
})
