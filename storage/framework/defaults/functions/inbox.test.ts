import { describe, expect, it } from 'bun:test'
import { mapDashboardInboxEntry, normalizeInboxPreview, parseInboxSender } from './inbox'

describe('dashboard inbox mapping', () => {
  it('prefers the structured sender name', () => {
    expect(parseInboxSender('sender@example.com', 'Sender Name')).toEqual({
      name: 'Sender Name',
      email: 'sender@example.com',
    })
  })

  it('parses a mailbox sender string', () => {
    expect(parseInboxSender('"Sender Name" <sender@example.com>')).toEqual({
      name: 'Sender Name',
      email: 'sender@example.com',
    })
  })

  it('maps an inbox entry without synthetic message metadata', () => {
    expect(mapDashboardInboxEntry({
      messageId: 'message-1',
      from: 'sender@example.com',
      subject: '',
      date: '2026-07-29T12:00:00.000Z',
      read: false,
      hasAttachments: true,
    })).toEqual({
      id: 'message-1',
      from: 'sender@example.com',
      email: 'sender@example.com',
      subject: '(no subject)',
      preview: '',
      bodyHtml: '',
      bodyText: '',
      date: '2026-07-29T12:00:00.000Z',
      read: false,
      hasAttachments: true,
      attachments: [],
      detailsLoaded: false,
    })
  })

  it('normalizes legacy MIME preambles in stored previews', () => {
    expect(mapDashboardInboxEntry({
      messageId: 'message-2',
      from: 'sender@example.com',
      subject: 'Sign in',
      preview: '--boundary Content-Type: text/plain; charset=utf-8 Content-Transfer-Encoding: quoted-printable Great news=E2=80=94your account is ready.',
      date: '2026-07-29T12:00:00.000Z',
    }).preview).toBe('Great news—your account is ready.')
  })

  it('bounds browser-safe preview normalization', () => {
    expect(normalizeInboxPreview('<p>Hello from the inbox</p>', 10)).toBe('Hello from')
  })
})
