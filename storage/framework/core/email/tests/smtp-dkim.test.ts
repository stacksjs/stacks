import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:net'
import { config } from '@stacksjs/config'
import { generateDkimKeyPair, verifyDkim } from '../src/dkim'
import { SMTPDriver } from '../src/drivers/smtp'

/** A mail server that takes one message and keeps what it was told. */
async function withServer<T>(run: (port: number, seen: { commands: string[], message: () => string }) => Promise<T>): Promise<T> {
  const commands: string[] = []
  const lines: string[] = []
  let inData = false
  const server = createServer((socket) => {
    socket.write('220 local.test ESMTP\r\n')
    let buffer = ''
    socket.on('data', (data) => {
      buffer += data.toString()
      let end = buffer.indexOf('\r\n')
      while (end !== -1) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (inData) {
          if (line === '.') {
            inData = false
            socket.write('250 queued\r\n')
          }
          else {
            // Undo dot-stuffing, as a server does before it reads the message.
            lines.push(line.startsWith('..') ? line.slice(1) : line)
          }
        }
        else {
          commands.push(line)
          if (line === 'DATA') {
            inData = true
            socket.write('354 go\r\n')
          }
          else if (line === 'QUIT') {
            socket.end('221 bye\r\n')
          }
          else {
            socket.write('250 ok\r\n')
          }
        }
        end = buffer.indexOf('\r\n')
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const originalSmtp = config.services.smtp
  const originalEncryption = process.env.MAIL_ENCRYPTION
  try {
    config.services.smtp = { host: '127.0.0.1', port: (server.address() as { port: number }).port, encryption: null, username: '', password: '' }
    delete process.env.MAIL_ENCRYPTION
    return await run((server.address() as { port: number }).port, { commands, message: () => `${lines.join('\r\n')}\r\n` })
  }
  finally {
    config.services.smtp = originalSmtp
    if (originalEncryption !== undefined)
      process.env.MAIL_ENCRYPTION = originalEncryption
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

const MESSAGE = {
  from: { name: 'Votescape', address: 'noreply@votescape.org' },
  to: 'reader@example.com',
  subject: 'Your results',
  text: 'Every county.\n.A line that starts with a dot.\nDone.',
  html: '<p>Every county.</p>',
}

describe('sending on behalf of another domain', () => {
  test('the envelope sender is the one named, and the From line is left as the message has it', async () => {
    await withServer(async (_port, seen) => {
      const result = await new SMTPDriver().send({ ...MESSAGE, envelopeFrom: 'bounces@commshq.org' })
      expect(result.success).toBe(true)
      expect(seen.commands).toContain('MAIL FROM:<bounces@commshq.org>')
      expect(seen.commands).not.toContain('MAIL FROM:<noreply@votescape.org>')
      expect(seen.message()).toContain('From: Votescape <noreply@votescape.org>')
    })
  })

  test('without one, the envelope sender is the From address, as before', async () => {
    await withServer(async (_port, seen) => {
      await new SMTPDriver().send(MESSAGE)
      expect(seen.commands).toContain('MAIL FROM:<noreply@votescape.org>')
      expect(seen.message()).not.toContain('DKIM-Signature')
    })
  })

  test('a message with a key is signed for its domain, and what the server receives verifies', async () => {
    const keys = generateDkimKeyPair()
    await withServer(async (_port, seen) => {
      const result = await new SMTPDriver().send({ ...MESSAGE, envelopeFrom: 'bounces@commshq.org', dkim: { domain: 'votescape.org', selector: 'commshq', privateKey: keys.privateKey } })
      expect(result.success).toBe(true)

      const received = seen.message()
      expect(received.startsWith('DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=votescape.org; s=commshq;')).toBe(true)
      // Through the wire, dot-stuffing and all, it is still the message that was signed.
      expect(verifyDkim(received, keys.publicKey)).toEqual({ ok: true, domain: 'votescape.org', selector: 'commshq' })
      expect(verifyDkim(received, generateDkimKeyPair().publicKey).ok).toBe(false)
    })
  })
})
