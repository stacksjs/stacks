import { describe, expect, it } from 'bun:test'
import type { EmailReprocessStorage } from '../src/email-reprocess'
import { reprocessInboundEmails } from '../src/email-reprocess'

describe('email reprocess', () => {
  it('stores parsed bodies and attachments while preserving read state', async () => {
    const raw = [
      'From: Sender <sender@example.net>',
      'To: Support <support@example.com>',
      'Subject: Files attached',
      'Date: Mon, 10 Aug 2026 12:00:00 +0000',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="mail"',
      '',
      '--mail',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Please review the attachment.',
      '--mail',
      'Content-Type: application/octet-stream',
      'Content-Disposition: attachment; filename="report.bin"',
      'Content-Transfer-Encoding: base64',
      '',
      'AP8QIIA=',
      '--mail--',
    ].join('\r\n')
    const stored = new Map<string, string | Uint8Array>()
    const inboxKey = 'mailboxes/example.com/support/inbox.json'
    stored.set(inboxKey, JSON.stringify([{
      messageId: 'message-1',
      from: 'old@example.net',
      fromName: '',
      to: 'support@example.com',
      subject: 'Old subject',
      date: '2026-08-09T12:00:00.000Z',
      read: true,
      preview: 'Old preview',
      hasAttachments: false,
      path: 'old/path',
    }]))
    const storage: EmailReprocessStorage = {
      async listAllObjects() {
        return [{ Key: 'inbox/message-1', LastModified: '2026-08-10T12:00:00.000Z' }]
      },
      async getObject(_bucket, key) {
        const value = stored.get(key)
        if (typeof value !== 'string')
          throw new Error('NoSuchKey')
        return value
      },
      async getObjectBytes(_bucket, key) {
        if (key !== 'inbox/message-1')
          throw new Error('NoSuchKey')
        return { body: new TextEncoder().encode(raw) }
      },
      async putObject(options) {
        stored.set(options.key, typeof options.body === 'string' ? options.body : Uint8Array.from(options.body))
      },
    }

    const report = await reprocessInboundEmails({
      storage,
      bucket: 'email-test',
      prefix: 'inbox/',
      domain: 'example.com',
    })

    expect(report).toEqual({
      discovered: 1,
      processed: 1,
      skipped: [],
      mailboxes: [{ mailbox: 'support@example.com', newCount: 0, refreshedCount: 1, total: 1 }],
    })
    const path = 'mailboxes/example.com/support/2026/08/10/message-1'
    expect(stored.get(`${path}/body.txt`)).toBe('Please review the attachment.')
    expect(stored.get(`${path}/attachments/stacks-0001--report.bin`)).toEqual(Uint8Array.from([0, 255, 16, 32, 128]))
    const metadata = JSON.parse(String(stored.get(`${path}/metadata.json`)))
    expect(metadata.hasAttachments).toBeTrue()
    expect(metadata.attachments).toEqual([{
      name: 'report.bin',
      contentType: 'application/octet-stream',
      size: 5,
      disposition: 'attachment',
    }])
    const inbox = JSON.parse(String(stored.get(inboxKey)))
    expect(inbox[0].read).toBeTrue()
    expect(inbox[0].hasAttachments).toBeTrue()
    expect(inbox[0].subject).toBe('Files attached')
  })
})
