import { expect, test } from 'bun:test'
import { prepareSpeechAudio } from '../src/speech-input'

function wav(seconds: number): Uint8Array {
  const size = Math.round(seconds * 32000)
  const bytes = new Uint8Array(44 + size)
  const view = new DataView(bytes.buffer)
  bytes.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, 36 + size, true)
  bytes.set(new TextEncoder().encode('WAVEfmt '), 8)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  bytes.set(new TextEncoder().encode('data'), 36)
  view.setUint32(40, size, true)
  return bytes
}

test('speech audio is decoded to bounded mono PCM, never trusting an uploaded duration', async () => {
  const result = await prepareSpeechAudio(wav(1), { maxDurationSeconds: 2 })
  expect(result.durationSeconds).toBe(1)
  expect(result.mimeType).toBe('audio/wav')
  expect(result.audio.length).toBeGreaterThan(32000)
  await expect(prepareSpeechAudio(wav(3), { maxDurationSeconds: 2 })).rejects.toThrow('duration')
  await expect(prepareSpeechAudio(new TextEncoder().encode('not audio'))).rejects.toThrow('audio')
  await expect(prepareSpeechAudio(wav(1), { maxBytes: 100 })).rejects.toThrow('size')
})

test('speech preparation respects cancellation before launching the decoder', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(prepareSpeechAudio(wav(1), { signal: controller.signal })).rejects.toThrow()
})
