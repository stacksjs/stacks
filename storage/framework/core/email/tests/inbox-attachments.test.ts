import { describe, expect, it } from 'bun:test'
import {
  inboxAttachmentContentDisposition,
  inboxAttachmentContentType,
  inboxAttachmentId,
  inboxAttachmentName,
  inboxAttachmentPrefix,
  mapInboxAttachmentObjects,
} from '../src/sdk/inbox-attachments'
import { type EmailStorageClient, EmailSDK } from '../src/sdk'

describe('inbox attachments', () => {
  const basePath = 'mailboxes/example.com/support/2026/08/10/message-1'

  it('maps stored objects without exposing unrelated keys', () => {
    const prefix = inboxAttachmentPrefix(basePath)
    const attachments = mapInboxAttachmentObjects(basePath, [
      { Key: `${prefix}invoice%20august.pdf`, Size: 8124, LastModified: '2026-08-10T12:00:00.000Z' },
      { Key: `${prefix}screenshots/ignored.png`, Size: 20 },
      { Key: `${prefix}empty/`, Size: 0 },
      { Key: 'mailboxes/example.com/other/private.txt', Size: 40 },
    ])

    expect(attachments).toEqual([
      {
        id: inboxAttachmentId(`${prefix}invoice%20august.pdf`),
        key: `${prefix}invoice%20august.pdf`,
        name: 'invoice august.pdf',
        size: 8124,
        lastModified: '2026-08-10T12:00:00.000Z',
      },
      {
        id: inboxAttachmentId(`${prefix}screenshots/ignored.png`),
        key: `${prefix}screenshots/ignored.png`,
        name: 'screenshots_ignored.png',
        size: 20,
      },
    ])
  })

  it('normalizes unsafe attachment names', () => {
    const prefix = inboxAttachmentPrefix(basePath)
    expect(inboxAttachmentName(`${prefix}../report\u0000.csv`, prefix)).toBe('.._report.csv')
  })

  it('removes the framework storage prefix from new attachment names', () => {
    const prefix = inboxAttachmentPrefix(basePath)
    expect(inboxAttachmentName(`${prefix}stacks-0003--quarterly%20report.pdf`, prefix)).toBe('quarterly report.pdf')
  })

  it('builds an encoded download disposition', () => {
    expect(inboxAttachmentContentDisposition('Q3 résumé.pdf')).toBe(
      'attachment; filename="Q3 resume.pdf"; filename*=UTF-8\'\'Q3%20r%C3%A9sum%C3%A9.pdf',
    )
  })

  it('normalizes untrusted attachment content types', () => {
    expect(inboxAttachmentContentType('Application/PDF; charset=binary')).toBe('application/pdf')
    expect(inboxAttachmentContentType('text/html\r\nx-unsafe: true')).toBe('application/octet-stream')
  })

  it('lists and downloads binary attachments through an injected storage client', async () => {
    const attachmentKey = `${inboxAttachmentPrefix(basePath)}Q3 report.pdf`
    const attachmentBody = Uint8Array.from([0, 255, 16, 32, 128])
    const inbox = [{
      messageId: 'message-1',
      from: 'sender@example.com',
      to: 'support@example.com',
      subject: 'Quarterly report',
      date: '2026-08-10T12:00:00.000Z',
      read: false,
      hasAttachments: false,
      path: basePath,
    }]
    const deletedKeys: string[] = []
    const storage: EmailStorageClient = {
      async getObject(_bucket, key) {
        if (key.endsWith('/inbox.json'))
          return JSON.stringify(inbox)
        if (key.endsWith('/metadata.json'))
          return JSON.stringify({ source: 'test' })
        if (key.endsWith('/body.txt'))
          return 'See the attached report.'
        return ''
      },
      async getObjectBytes(_bucket, key) {
        if (key !== attachmentKey)
          throw new Error('Unexpected attachment key.')
        return { body: attachmentBody, contentType: 'application/pdf', contentLength: attachmentBody.byteLength }
      },
      async listObjects() {
        return {
          objects: [{ Key: attachmentKey, Size: attachmentBody.byteLength, LastModified: '2026-08-10T12:00:00.000Z' }],
        }
      },
      async deleteObjects(_bucket, keys) {
        deletedKeys.push(...keys)
      },
      async putObject() {},
    }
    const sdk = new EmailSDK({
      bucket: 'test-email',
      domain: 'example.com',
      storage: () => storage,
    })

    const email = await sdk.getEmail('support@example.com', 'message-1')
    expect(email?.attachments).toEqual([{
      id: inboxAttachmentId(attachmentKey),
      name: 'Q3 report.pdf',
      size: attachmentBody.byteLength,
      lastModified: '2026-08-10T12:00:00.000Z',
    }])

    const download = await sdk.getAttachment('support@example.com', 'message-1', inboxAttachmentId(attachmentKey))
    expect(download?.contentType).toBe('application/pdf')
    expect(download?.body).toEqual(attachmentBody)
    expect(await sdk.getAttachment('support@example.com', 'message-1', 'untrusted-id')).toBeNull()

    expect(await sdk.delete('support@example.com', 'message-1')).toBeTrue()
    expect(deletedKeys).toContain(attachmentKey)
  })
})
