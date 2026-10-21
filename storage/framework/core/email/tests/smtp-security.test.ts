import type { EmailMessage } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:net'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { SMTPDriver } from '../src/drivers/smtp'
import { buildMimeMessage } from '../src/mime'

const message = { from: { address: 'sender@example.com' }, to: 'to@example.com', subject: 'subject', text: 'body' }

describe('SMTP wire boundaries', () => {
  test('dot-stuffs all body lines after normalizing line endings', async () => {
    const commands: string[] = []
    let body = ''
    let inData = false
    const server = createServer((socket) => {
      socket.write('220 local.test ESMTP\r\n')
      let buffer = ''
      socket.on('data', (data) => {
        buffer += data.toString()
        let end: number
        while ((end = buffer.indexOf('\r\n')) !== -1) {
          const line = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (inData) {
            if (line === '.') { inData = false; socket.write('250 queued\r\n') }
            else { body += `${line}\n` }
          }
          else {
            commands.push(line)
            if (line === 'DATA') { inData = true; socket.write('354 go\r\n') }
            else if (line === 'QUIT') { socket.end('221 bye\r\n') }
            else { socket.write('250 ok\r\n') }
          }
        }
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const originalSmtp = config.services.smtp
    const originalEncryption = process.env.MAIL_ENCRYPTION
    try {
      const address = server.address() as { port: number }
      config.services.smtp = { host: '127.0.0.1', port: address.port, encryption: null, username: '', password: '' }
      delete process.env.MAIL_ENCRYPTION
      const driver = new SMTPDriver()
      const result = await driver.send({ ...message, text: 'hello\n.\nRCPT TO:<injected@example.com>\r.more\r\n..last' })
      expect(result.success).toBe(true)
      expect(commands).not.toContain('RCPT TO:<injected@example.com>')
      expect(body).toContain('hello\n..\nRCPT TO:<injected@example.com>\n..more\n...last')
    }
    finally {
      config.services.smtp = originalSmtp
      if (originalEncryption !== undefined) process.env.MAIL_ENCRYPTION = originalEncryption
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  test('authentication travels on the wire without entering debug logs', async () => {
    const username = 'private-user@example.test'
    const password = 'private-smtp-password'
    const wire: string[] = []
    const logs: string[] = []
    const originalDebug = log.debug
    const originalSmtp = config.services.smtp
    const server = createServer((socket) => {
      socket.write('220 local.test ESMTP\r\n')
      let buffer = ''
      let authStep = 0
      let inData = false
      socket.on('data', (data) => {
        buffer += data.toString()
        let end: number
        while ((end = buffer.indexOf('\r\n')) !== -1) {
          const line = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          wire.push(line)
          if (inData) {
            if (line === '.') { inData = false; socket.write('250 queued\r\n') }
          }
          else if (line === 'AUTH LOGIN') { authStep = 1; socket.write('334 username\r\n') }
          else if (authStep === 1) { authStep = 2; socket.write('334 password\r\n') }
          else if (authStep === 2) { authStep = 0; socket.write('235 authenticated\r\n') }
          else if (line === 'DATA') { inData = true; socket.write('354 go\r\n') }
          else if (line === 'QUIT') { socket.end('221 bye\r\n') }
          else { socket.write('250 ok\r\n') }
        }
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      log.debug = (...args) => { logs.push(args.map(String).join(' ')) }
      config.services.smtp = { host: '127.0.0.1', port: (server.address() as { port: number }).port,
        encryption: null, username, password }
      const result = await new SMTPDriver().send(message)
      expect(result.success).toBe(true)
      for (const credential of [username, password]) {
        const encoded = Buffer.from(credential).toString('base64')
        expect(wire).toContain(encoded)
        expect(logs.join(' ')).not.toContain(encoded)
        expect(logs.join(' ')).not.toContain(credential)
      }
      expect(logs.join(' ')).toContain('[redacted authentication]')
    }
    finally {
      config.services.smtp = originalSmtp
      log.debug = originalDebug
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  test.each([
    { from: { address: 'sender@example.com', name: 'name\r\nBcc: hidden@example.com' } },
    { replyTo: 'reply@example.com\r\nBcc: hidden@example.com' },
    { to: [{ address: 'to@example.com', name: 'name\r\nBcc: hidden@example.com' }] },
  ])('rejects newline-bearing address metadata before connecting: %j', async (extra) => {
    const driver = new SMTPDriver({ host: '127.0.0.1', port: 1, encryption: null })
    const result = await driver.send({ ...message, ...extra } as EmailMessage)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/forbidden|malformed/i)
  })

  test.each([
    { from: 'sender@example.com\r\nBcc: hidden@example.com' },
    { replyTo: 'reply@example.com\r\nBcc: hidden@example.com' },
    { messageIdDomain: 'example.com\r\nBcc: hidden@example.com' },
    { customHeaders: { 'X-Unsafe: injected': 'value' } },
    { attachments: [{ filename: 'a\r\nBcc: hidden@example.com', content: 'x' }] },
    { attachments: [{ filename: 'a', content: 'x', contentType: 'text/plain\r\nBcc: hidden@example.com' }] },
  ])('rejects header injection at the shared MIME boundary: %j', (extra) => {
    expect(() => buildMimeMessage({ from: 'from@example.com', to: 'to@example.com', subject: 's', ...extra })).toThrow()
  })
})
