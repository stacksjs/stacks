import { describe, expect, test } from 'bun:test'

const { emailParagraphs, notificationEmailHtml, notificationEmailText } = await import('../src/email-body')

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
