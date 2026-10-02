import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalStorage, createMemoryStorage, Storage } from '@stacksjs/storage'
import { SPEECH_DRIVERS, speechMimeType, speechToText, storeSpeech, textToSpeech } from '../src/speech'

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENAI_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined)
    delete process.env.OPENAI_API_KEY
  else
    process.env.OPENAI_API_KEY = originalKey
})

interface Captured { url: string, init: RequestInit }

function mockFetch(response: () => Response): Captured[] {
  const calls: Captured[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return response()
  }) as typeof fetch
  return calls
}

const openaiConfig = { default: 'openai', drivers: { openai: { apiKey: 'sk-test' } } }
const audioBytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00])

describe('textToSpeech', () => {
  test('posts the OpenAI /audio/speech request shape with defaults', async () => {
    const calls = mockFetch(() => new Response(audioBytes, { headers: { 'Content-Type': 'audio/mpeg' } }))

    const speech = await textToSpeech('Hello there', { config: openaiConfig })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.openai.com/v1/audio/speech')
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      model: 'gpt-4o-mini-tts',
      input: 'Hello there',
      voice: 'alloy',
      response_format: 'mp3',
    })

    expect(speech.audio).toEqual(audioBytes)
    expect(speech.mimeType).toBe('audio/mpeg')
    expect(speech).toMatchObject({ format: 'mp3', driver: 'openai', model: 'gpt-4o-mini-tts', voice: 'alloy' })
  })

  test('forwards model, voice, format, speed, instructions and a custom base URL', async () => {
    const calls = mockFetch(() => new Response(audioBytes))

    const speech = await textToSpeech('Hi', {
      config: { default: 'openai', drivers: { openai: { apiKey: 'k', baseUrl: 'https://proxy.example/v1/' } } },
      model: 'gpt-4o-mini-tts',
      voice: 'nova',
      format: 'wav',
      speed: 1.25,
      instructions: 'Speak warmly.',
    })

    expect(calls[0].url).toBe('https://proxy.example/v1/audio/speech')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      model: 'gpt-4o-mini-tts',
      input: 'Hi',
      voice: 'nova',
      response_format: 'wav',
      speed: 1.25,
      instructions: 'Speak warmly.',
    })
    // No audio/* content type on the response: fall back to the format's MIME type.
    expect(speech.mimeType).toBe('audio/wav')
  })

  test('an explicit driver overrides the configured default, and the env key is used', async () => {
    process.env.OPENAI_API_KEY = 'sk-env'
    const calls = mockFetch(() => new Response(audioBytes))

    await textToSpeech('Hi', { driver: 'openai', config: { default: 'anthropic' } })

    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-env')
  })

  test('a configured OpenAI model id as default selects the OpenAI driver', async () => {
    mockFetch(() => new Response(audioBytes))
    const speech = await textToSpeech('Hi', { config: { default: 'gpt-4o', drivers: { openai: { apiKey: 'k' } } } })
    expect(speech.driver).toBe('openai')
  })

  test('HTTP failures include the status and a body snippet', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: 'Invalid voice' } }), { status: 400 }))

    await expect(textToSpeech('Hi', { config: openaiConfig })).rejects.toThrow(
      'OpenAI text-to-speech failed with HTTP 400: {"error":{"message":"Invalid voice"}}',
    )
  })

  test('long error bodies are truncated', async () => {
    mockFetch(() => new Response('x'.repeat(2000), { status: 500 }))

    const error = await textToSpeech('Hi', { config: openaiConfig, retry: { maxRetries: 0 } }).catch(e => e as Error)
    expect(error.message).toStartWith('OpenAI text-to-speech failed with HTTP 500: xxx')
    expect(error.message.length).toBeLessThan(600)
  })

  test('drivers without speech support fail naming the driver and the supported ones', async () => {
    const calls = mockFetch(() => new Response(audioBytes))

    await expect(textToSpeech('Hi', { driver: 'anthropic', config: openaiConfig }))
      .rejects.toThrow('Text-to-speech is not supported by the "anthropic" AI driver. Drivers that support it: openai.')
    await expect(textToSpeech('Hi', { config: { default: 'ollama' } }))
      .rejects.toThrow('not supported by the "ollama" AI driver')
    await expect(textToSpeech('Hi', { config: { default: 'meta.llama2-70b-chat-v1' } }))
      .rejects.toThrow('not supported by the "meta.llama2-70b-chat-v1" AI driver')
    expect(calls).toHaveLength(0)
    expect(SPEECH_DRIVERS).toEqual(['openai'])
  })

  test('validates input before calling the provider', async () => {
    const calls = mockFetch(() => new Response(audioBytes))

    await expect(textToSpeech('  ', { config: openaiConfig })).rejects.toThrow('non-empty text')
    await expect(textToSpeech('Hi', { config: openaiConfig, speed: 5 })).rejects.toThrow('between 0.25 and 4.0')
    await expect(textToSpeech('x'.repeat(4097), { config: openaiConfig })).rejects.toThrow('at most 4096 characters')
    await expect(textToSpeech('Hi', { config: openaiConfig, format: 'ogg' as any })).rejects.toThrow('Unsupported speech format')
    await expect(textToSpeech('Hi', { config: openaiConfig, model: 'tts-1', instructions: 'calm' }))
      .rejects.toThrow('does not support `instructions`')
    expect(calls).toHaveLength(0)
  })

  test('a missing API key is reported clearly', async () => {
    delete process.env.OPENAI_API_KEY
    mockFetch(() => new Response(audioBytes))
    await expect(textToSpeech('Hi', { config: { default: 'openai' } })).rejects.toThrow('OpenAI API key not set')
  })

  test('speechMimeType maps every format', () => {
    expect(speechMimeType('mp3')).toBe('audio/mpeg')
    expect(speechMimeType('flac')).toBe('audio/flac')
  })
})

describe('storeSpeech', () => {
  test('writes to a storage adapter instance', async () => {
    const disk = createMemoryStorage()
    const stored = await storeSpeech({ audio: audioBytes, mimeType: 'audio/mpeg' }, 'speech/hello.mp3', { disk })

    expect(stored).toEqual({ path: 'speech/hello.mp3', size: audioBytes.length, mimeType: 'audio/mpeg' })
    expect(await disk.readToUint8Array('speech/hello.mp3')).toEqual(audioBytes)
  })

  test('writes synthesized audio to a local disk', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-ai-speech-'))
    try {
      mockFetch(() => new Response(audioBytes, { headers: { 'Content-Type': 'audio/mpeg' } }))
      const speech = await textToSpeech('Welcome', { config: openaiConfig })
      const stored = await storeSpeech(speech, 'audio/welcome.mp3', { disk: createLocalStorage({ root }) })

      expect(stored.size).toBe(audioBytes.length)
      expect(new Uint8Array(readFileSync(join(root, 'audio/welcome.mp3')))).toEqual(audioBytes)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('resolves a disk by name through the Storage facade', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-ai-speech-'))
    try {
      Storage.init({ disks: { speech: { driver: 'local', root } } })
      const stored = await storeSpeech({ audio: audioBytes, mimeType: 'audio/mpeg' }, 'clips/a.mp3', { disk: 'speech' })

      expect(stored.path).toBe('clips/a.mp3')
      expect(new Uint8Array(readFileSync(join(root, 'clips/a.mp3')))).toEqual(audioBytes)
    }
    finally {
      Storage.init({})
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('rejects an empty path', async () => {
    await expect(storeSpeech({ audio: audioBytes, mimeType: 'audio/mpeg' }, '', { disk: createMemoryStorage() }))
      .rejects.toThrow('needs a destination path')
  })
})

describe('speechToText', () => {
  test('posts multipart audio to /audio/transcriptions and returns the text', async () => {
    const calls = mockFetch(() => Response.json({ text: 'hello world' }))

    const result = await speechToText(new Blob([audioBytes], { type: 'audio/wav' }), {
      config: openaiConfig,
      language: 'en',
      temperature: 0,
    })

    expect(result).toEqual({ text: 'hello world', driver: 'openai', model: 'whisper-1' })
    expect(calls[0].url).toBe('https://api.openai.com/v1/audio/transcriptions')
    const form = calls[0].init.body as FormData
    expect(form.get('model')).toBe('whisper-1')
    expect(form.get('response_format')).toBe('json')
    expect(form.get('language')).toBe('en')
    expect(form.get('temperature')).toBe('0')
    expect((form.get('file') as File).name).toBe('audio.wav')
  })

  test('uses the given filename for raw bytes', async () => {
    const calls = mockFetch(() => Response.json({ text: 'ok' }))
    await speechToText(audioBytes, { config: openaiConfig, filename: 'memo.m4a', model: 'gpt-4o-mini-transcribe' })
    const form = calls[0].init.body as FormData
    expect((form.get('file') as File).name).toBe('memo.m4a')
    expect(form.get('model')).toBe('gpt-4o-mini-transcribe')
  })

  test('fails on unsupported drivers and HTTP errors', async () => {
    mockFetch(() => new Response('bad audio', { status: 400 }))
    await expect(speechToText(audioBytes, { driver: 'ollama', config: openaiConfig }))
      .rejects.toThrow('Speech-to-text is not supported by the "ollama" AI driver. Drivers that support it: openai.')
    await expect(speechToText(audioBytes, { config: openaiConfig }))
      .rejects.toThrow('OpenAI speech-to-text failed with HTTP 400: bad audio')
  })
})
