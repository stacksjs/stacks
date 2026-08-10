import { describe, expect, it } from 'bun:test'
import {
  inboundAttachmentName,
  inboundMailboxRecipient,
  inboundMessageStorageId,
  parseInboundEmail,
} from '../src/inbound-parser'

describe('inbound email parser', () => {
  it('parses nested bodies, recipients, and binary attachments', async () => {
    const raw = [
      'From: =?UTF-8?Q?Example_Sender?= <Sender@Example.com>',
      'To: Support <support@example.com>',
      'Delivered-To: archive@example.com',
      'Subject: Quarterly files',
      'Date: Mon, 10 Aug 2026 12:00:00 +0000',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="outer"',
      '',
      '--outer',
      'Content-Type: multipart/alternative; boundary="inner"',
      '',
      '--inner',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Plain body',
      '--inner',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>HTML body</p>',
      '--inner--',
      '--outer',
      'Content-Type: application/octet-stream; name="../report.bin"',
      'Content-Disposition: attachment; filename="../report.bin"',
      'Content-Transfer-Encoding: base64',
      '',
      'AP8QIIA=',
      '--outer--',
    ].join('\r\n')

    const parsed = await parseInboundEmail(raw)
    expect(parsed.from).toBe('sender@example.com')
    expect(parsed.fromName).toBe('Example Sender')
    expect(parsed.recipients).toEqual(['support@example.com', 'archive@example.com'])
    expect(parsed.subject).toBe('Quarterly files')
    expect(parsed.text).toBe('Plain body')
    expect(parsed.html).toContain('<p>HTML body</p>')
    expect(parsed.attachments).toHaveLength(1)
    expect(parsed.attachments[0]?.name).toBe('.._report.bin')
    expect(parsed.attachments[0]?.storageName).toBe('stacks-0001--.._report.bin')
    expect(parsed.attachments[0]?.content).toEqual(Uint8Array.from([0, 255, 16, 32, 128]))
  })

  it('provides stable names for unnamed attachments', () => {
    expect(inboundAttachmentName(null, 2)).toBe('attachment-3')
  })

  it('accepts only mailbox-safe recipients on the configured domain', () => {
    expect(inboundMailboxRecipient('Support+alerts@Example.com', 'example.com')).toEqual({
      address: 'support+alerts@example.com',
      domain: 'example.com',
      localPart: 'support+alerts',
    })
    expect(inboundMailboxRecipient('other@example.net', 'example.com')).toBeNull()
    expect(inboundMailboxRecipient('../escape@example.com', 'example.com')).toBeNull()
  })

  it('normalizes message IDs before using them in object paths', () => {
    expect(inboundMessageStorageId('folder\\message.eml')).toBe('folder_message.eml')
    expect(() => inboundMessageStorageId('..')).toThrow('no safe message identifier')
  })
})
