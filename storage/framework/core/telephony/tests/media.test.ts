import { expect, test } from 'bun:test'
import { AudioQueue, MediaStreamSession, mediaMessage, parseMediaEvent } from '../src/index.ts'

const accountSid = `AC${'a'.repeat(32)}`
const callSid = `CA${'b'.repeat(32)}`
const streamSid = `MZ${'c'.repeat(32)}`
const start = { event: 'start', sequenceNumber: '1', streamSid, start: { accountSid, callSid, streamSid, tracks: ['inbound'], customParameters: { workspace: 'one' }, mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 } } }
const media = { event: 'media', sequenceNumber: '2', streamSid, media: { track: 'inbound', chunk: '1', timestamp: '0', payload: '/wAB' } }

test('parses bounded mu-law frames and enforces connected/start/account/stream/sequence boundaries', () => {
  const session = new MediaStreamSession({ accountSid, callSid, maxTotalAudioBytes: 6 })
  expect(session.accept(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' })).event).toBe('connected')
  expect(session.accept(JSON.stringify(start)).event).toBe('start')
  const frame = session.accept(JSON.stringify(media))
  expect(frame.event).toBe('media')
  if (frame.event === 'media') expect([...frame.audio]).toEqual([255, 0, 1])
  expect(() => session.accept(JSON.stringify(media))).toThrow()
  expect(() => session.accept(JSON.stringify({ ...media, sequenceNumber: '3', streamSid: `MZ${'d'.repeat(32)}` }))).toThrow()
  expect(session.accept(JSON.stringify({ ...media, sequenceNumber: '3' })).event).toBe('media')
  expect(() => session.accept(JSON.stringify({ ...media, sequenceNumber: '4' }))).toThrow()
  const wrong = new MediaStreamSession({ accountSid, callSid: `CA${'e'.repeat(32)}` })
  wrong.accept(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }))
  expect(() => wrong.accept(JSON.stringify(start))).toThrow()
})

test('rejects bad audio format, malformed base64 and oversized JSON/audio before buffering', () => {
  expect(() => parseMediaEvent(JSON.stringify({ ...start, start: { ...start.start, mediaFormat: { encoding: 'audio/wav', sampleRate: 8000, channels: 1 } } }))).toThrow()
  expect(() => parseMediaEvent(JSON.stringify({ ...media, media: { ...media.media, payload: '!!!!' } }))).toThrow()
  expect(() => parseMediaEvent(JSON.stringify(media), { maxAudioBytes: 2 })).toThrow()
  expect(() => parseMediaEvent(' '.repeat(65537))).toThrow()
  expect(() => mediaMessage(streamSid, new Uint8Array(8001))).toThrow()
  expect(mediaMessage(streamSid, new Uint8Array([255, 0, 1]))).toBe(JSON.stringify({ event: 'media', streamSid, media: { payload: '/wAB' } }))
})

test('audio backpressure rejects overflow explicitly and retains every accepted frame', () => {
  const queue = new AudioQueue({ maxBytes: 4, maxFrames: 2 })
  queue.push(new Uint8Array([1, 2]))
  queue.push(new Uint8Array([3, 4]))
  expect(() => queue.push(new Uint8Array([5]))).toThrow()
  expect(queue.byteLength).toBe(4)
  expect([...queue.shift()!]).toEqual([1, 2])
  expect([...queue.shift()!]).toEqual([3, 4])
  expect(queue.shift()).toBeUndefined()
  expect(queue.byteLength).toBe(0)
})

test('accepts mark/DTMF/stop events and refuses further events on a stopped stream', () => {
  const session = new MediaStreamSession({ accountSid, callSid })
  session.accept('{"event":"connected","protocol":"Call","version":"1.0.0"}')
  session.accept(JSON.stringify(start))
  expect(session.accept(JSON.stringify({ event: 'mark', sequenceNumber: '2', streamSid, mark: { name: 'speech:1' } }))).toMatchObject({ event: 'mark', name: 'speech:1' })
  expect(session.accept(JSON.stringify({ event: 'dtmf', sequenceNumber: '3', streamSid, dtmf: { track: 'inbound_track', digit: '#' } }))).toMatchObject({ event: 'dtmf', digit: '#' })
  expect(session.accept(JSON.stringify({ event: 'stop', sequenceNumber: '4', streamSid, stop: { accountSid, callSid } })).event).toBe('stop')
  expect(() => session.accept(JSON.stringify({ ...media, sequenceNumber: '5' }))).toThrow()
})
