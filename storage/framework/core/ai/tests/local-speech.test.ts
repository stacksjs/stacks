import { describe, expect, it } from 'bun:test'
import { createLocalSpeechHandler } from '../src/local-speech'

const bearerToken = 'local-speech-private-test-token-123'
const wav = new Uint8Array(48)
wav.set(new TextEncoder().encode('RIFF'), 0)
wav.set(new TextEncoder().encode('WAVE'), 8)
function request(audio = wav, token = bearerToken) {
  const form = new FormData()
  form.set('file', new Blob([audio], { type: 'audio/wav' }), 'feedback.wav')
  form.set('response_format', 'json')
  return new Request('http://127.0.0.1/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
}

describe('local speech service', () => {
  it('requires a private token and returns the OpenAI-compatible transcript', async () => {
    const handler = createLocalSpeechHandler({ bearerToken, modelPath: '/models/base.bin', transcribe: async () => '  My easy run felt comfortable.  ' })
    expect((await handler(request(wav, 'wrong'))).status).toBe(401)
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'My easy run felt comfortable.' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(() => createLocalSpeechHandler({ bearerToken: '', modelPath: 'missing' })).toThrow()
  })

  it('rejects oversized and invalid recordings before inference', async () => {
    let called = 0
    const handler = createLocalSpeechHandler({ bearerToken, modelPath: '', maxBytes: 48, transcribe: async () => { called++; return 'text' } })
    expect((await handler(request(new Uint8Array(49)))).status).toBe(413)
    expect((await handler(request(new Uint8Array(48)))).status).toBe(422)
    expect(called).toBe(0)
  })

  it('limits concurrent inference and releases its slot on success or failure', async () => {
    let release!: (text: string) => void
    const handler = createLocalSpeechHandler({ bearerToken, modelPath: '', transcribe: async () => new Promise<string>(resolve => { release = resolve }) })
    const first = handler(request())
    for (let i = 0; !release && i < 20; i++) await Bun.sleep(1)
    expect((await handler(request())).status).toBe(503)
    release('A clear recording')
    expect((await first).status).toBe(200)
    const failure = createLocalSpeechHandler({ bearerToken, modelPath: '', transcribe: async () => { throw new Error('/private/path/should-not-leak') } })
    const failed = await failure(request())
    expect(failed.status).toBe(422)
    expect(await failed.text()).not.toContain('/private/path')
    expect((await failure(request())).status).toBe(422)
  })

  it('aborts a timed-out engine and does not return a late transcript', async () => {
    const handler = createLocalSpeechHandler({ bearerToken, modelPath: '', timeoutMs: 10, transcribe: async (_, signal) => new Promise<string>(resolve => { signal.addEventListener('abort', () => resolve('Late words'), { once: true }) }) })
    expect((await handler(request())).status).toBe(504)
    expect((await handler(request())).status).toBe(504)
  })
})
