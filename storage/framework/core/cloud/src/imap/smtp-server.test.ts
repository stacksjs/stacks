import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import * as net from 'node:net'
import { SmtpServer } from './smtp-server'

const TEST_PORT = 12587
const TEST_DOMAIN = 'test.example.com'
const TEST_USERS = {
  chris: { password: 'test-password-123', email: 'chris@test.example.com' },
  blake: { password: 'blake-pass-456', email: 'blake@test.example.com' },
}

let server: SmtpServer

function connect(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port: TEST_PORT, host: '127.0.0.1' }, () => {
      resolve(socket)
    })
    socket.on('error', reject)
  })
}

function readLine(socket: net.Socket): Promise<string> {
  return new Promise((resolve) => {
    let buffer = ''
    const onData = (data: Buffer) => {
      buffer += data.toString()
      const lineEnd = buffer.indexOf('\r\n')
      if (lineEnd !== -1) {
        socket.removeListener('data', onData)
        resolve(buffer.slice(0, lineEnd))
      }
    }
    socket.on('data', onData)
  })
}

function readLines(socket: net.Socket, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = []
    let buffer = ''
    const onData = (data: Buffer) => {
      buffer += data.toString()
      let lineEnd: number
      while ((lineEnd = buffer.indexOf('\r\n')) !== -1) {
        lines.push(buffer.slice(0, lineEnd))
        buffer = buffer.slice(lineEnd + 2)
        if (lines.length >= count) {
          socket.removeListener('data', onData)
          resolve(lines)
          return
        }
      }
    }
    socket.on('data', onData)
  })
}

function send(socket: net.Socket, command: string): void {
  socket.write(`${command}\r\n`)
}

describe('SmtpServer', () => {
  beforeAll(async () => {
    server = new SmtpServer({
      port: TEST_PORT,
      host: '127.0.0.1',
      domain: TEST_DOMAIN,
      users: TEST_USERS,
    })
    await server.start()
    // Give the server a moment to bind
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    await server.stop()
  })

  it('sends 220 greeting on connect', async () => {
    const socket = await connect()
    const greeting = await readLine(socket)
    expect(greeting).toStartWith('220')
    expect(greeting).toContain(TEST_DOMAIN)
    socket.destroy()
  })

  it('responds to EHLO with capabilities', async () => {
    const socket = await connect()
    await readLine(socket) // greeting
    send(socket, 'EHLO client.test')
    const lines = await readLines(socket, 6) // 250-... lines + 250 OK
    const joined = lines.join('\n')
    expect(joined).toContain('SIZE')
    expect(joined).toContain('8BITMIME')
    expect(joined).toContain('PIPELINING')
    expect(joined).toContain('AUTH PLAIN LOGIN')
    // STARTTLS only advertised when TLS certs are configured
    socket.destroy()
  })

  it('authenticates with AUTH PLAIN (valid credentials)', async () => {
    const socket = await connect()
    await readLine(socket) // greeting
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    // AUTH PLAIN: \0username\0password in base64
    const credentials = Buffer.from(`\0chris\0test-password-123`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    const response = await readLine(socket)
    expect(response).toStartWith('235')
    socket.destroy()
  })

  it('rejects AUTH PLAIN with wrong password', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    const credentials = Buffer.from(`\0chris\0wrong-password`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    const response = await readLine(socket)
    expect(response).toStartWith('535')
    socket.destroy()
  })

  it('rejects AUTH PLAIN with unknown user', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    const credentials = Buffer.from(`\0nobody\0some-password`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    const response = await readLine(socket)
    expect(response).toStartWith('535')
    socket.destroy()
  })

  it('strips domain from username during AUTH', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    // Use chris@test.example.com as username — should strip to 'chris'
    const credentials = Buffer.from(`\0chris@test.example.com\0test-password-123`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    const response = await readLine(socket)
    expect(response).toStartWith('235')
    socket.destroy()
  })

  it('authenticates with AUTH LOGIN flow', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    send(socket, 'AUTH LOGIN')
    const usernamePrompt = await readLine(socket)
    expect(usernamePrompt).toStartWith('334')

    // Send username in base64
    send(socket, Buffer.from('chris').toString('base64'))
    const passwordPrompt = await readLine(socket)
    expect(passwordPrompt).toStartWith('334')

    // Send password in base64
    send(socket, Buffer.from('test-password-123').toString('base64'))
    const response = await readLine(socket)
    expect(response).toStartWith('235')
    socket.destroy()
  })

  it('rejects MAIL FROM without authentication', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    send(socket, 'MAIL FROM:<chris@test.example.com>')
    const response = await readLine(socket)
    expect(response).toStartWith('530')
    socket.destroy()
  })

  it('rejects MAIL FROM with wrong domain', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    const credentials = Buffer.from(`\0chris\0test-password-123`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    await readLine(socket) // 235

    send(socket, 'MAIL FROM:<chris@wrong-domain.com>')
    const response = await readLine(socket)
    expect(response).toStartWith('553')
    socket.destroy()
  })

  it('accepts MAIL FROM with correct domain after auth', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    const credentials = Buffer.from(`\0chris\0test-password-123`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    await readLine(socket) // 235

    send(socket, 'MAIL FROM:<chris@test.example.com>')
    const response = await readLine(socket)
    expect(response).toStartWith('250')
    socket.destroy()
  })

  it('accepts RCPT TO after MAIL FROM', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'EHLO client.test')
    await readLines(socket, 6)

    const credentials = Buffer.from(`\0chris\0test-password-123`).toString('base64')
    send(socket, `AUTH PLAIN ${credentials}`)
    await readLine(socket)

    send(socket, 'MAIL FROM:<chris@test.example.com>')
    await readLine(socket) // 250

    send(socket, 'RCPT TO:<someone@example.com>')
    const response = await readLine(socket)
    expect(response).toStartWith('250')
    socket.destroy()
  })

  it('responds to NOOP with 250', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'NOOP')
    const response = await readLine(socket)
    expect(response).toStartWith('250')
    socket.destroy()
  })

  it('responds to RSET with 250', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'RSET')
    const response = await readLine(socket)
    expect(response).toStartWith('250')
    socket.destroy()
  })

  it('responds to QUIT with 221 and closes', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'QUIT')
    const response = await readLine(socket)
    expect(response).toStartWith('221')

    await new Promise<void>((resolve) => {
      socket.on('close', () => resolve())
      setTimeout(resolve, 500) // fallback
    })
    expect(socket.destroyed || socket.readableEnded).toBe(true)
    socket.destroy()
  })

  it('rejects unknown commands', async () => {
    const socket = await connect()
    await readLine(socket)
    send(socket, 'BOGUS')
    const response = await readLine(socket)
    expect(response).toStartWith('500')
    socket.destroy()
  })
})
