import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { generateKeyPairSync, verify } from 'node:crypto'
import http2 from 'node:http2'
import { buildPayload, buildProviderToken, configure, resetConfiguration, send } from '../src/drivers/apns'

const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
afterEach(() => resetConfiguration())
describe('native Apple push', () => {
  it('signs an Apple ES256 provider token with the correct raw signature and claims', () => {
    const jwt = buildProviderToken('TEAM123456', 'KEY1234567', privateKey, 1791200000)
    const [header, claims, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567' })
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({ iss: 'TEAM123456', iat: 1791200000 })
    expect(Buffer.from(signature!, 'base64url')).toHaveLength(64)
    expect(verify('sha256', Buffer.from(`${header}.${claims}`), { key: keys.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature!, 'base64url'))).toBe(true)
  })
  it('protects the aps envelope, carries the phone link, and enforces the byte limit', () => {
    const payload = JSON.parse(buildPayload({ title: 'Pawel', body: 'New message', data: { href: '/m/messages?person=7', aps: { alert: 'override' } }, badge: 2 }))
    expect(payload.aps).toEqual({ alert: { title: 'Pawel', body: 'New message' }, sound: 'default', badge: 2 })
    expect(payload.href).toBe('/m/messages?person=7')
    expect(() => buildPayload({ body: '😀'.repeat(1100) })).toThrow('4096 bytes')
  })
  it('requires actual Apple tokens and credentials', async () => {
    expect((await send('firebase-token', { body: 'Hello' })).success).toBe(false)
    expect((await send([], { body: 'Hello' })).success).toBe(false)
  })
  it('sends the native HTTP/2 request and reports Apple rejection instead of a false success', async () => {
    const requests: Record<string, unknown>[] = []
    const server = http2.createServer()
    server.on('stream', (stream, headers) => {
      requests.push(headers)
      if (String(headers[':path']).includes('bbbb')) { stream.respond({ ':status': 410 }); stream.end(JSON.stringify({ reason: 'Unregistered' })) }
      else { stream.respond({ ':status': 200, 'apns-id': 'accepted-test-id' }); stream.end() }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    const connect = http2.connect
    const mock = spyOn(http2, 'connect').mockImplementation(() => connect(`http://127.0.0.1:${port}`))
    configure({ teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey, topic: 'training.hq.app' })
    try {
      const result = await send(['a'.repeat(64), 'b'.repeat(64)], { title: 'Pawel', body: 'Push QA', collapseId: 'notification:7' })
      expect(result.success).toBe(false)
      expect(result.data?.results).toMatchObject([{ success: true, status: 200 }, { success: false, status: 410, reason: 'Unregistered' }])
      expect(requests[0]).toMatchObject({ ':method': 'POST', 'apns-topic': 'training.hq.app', 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-collapse-id': 'notification:7' })
    }
    finally { mock.mockRestore(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })
})
