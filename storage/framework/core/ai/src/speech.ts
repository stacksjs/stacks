/**
 * Provider-neutral speech: text-to-speech and speech-to-text (stacksjs/stacks#306).
 *
 * `textToSpeech()` and `speechToText()` pick a driver the same way the rest of
 * the package does - an explicit `driver` option wins, otherwise `default` from
 * `config/ai.ts` - and return plain data (audio bytes + MIME type, or text) so
 * callers never touch a provider's wire format. `storeSpeech()` writes a
 * synthesized clip to a Stacks storage disk.
 *
 * Only the OpenAI driver implements speech today. Every other driver fails
 * with an error that names it and lists the drivers that do, rather than
 * silently falling back to a provider the application did not choose.
 */

import type { AIProvider, ConfiguredAIOptions } from './types'
import type { RetryConfig } from './utils/retry'
import { resolveAIProvider } from './client'
import { fetchWithRetry } from './utils/retry'

// ============================================================================
// Types
// ============================================================================

/** A driver name: one of the built-in providers, or anything `config/ai.ts` holds. */
export type SpeechDriver = AIProvider | (string & {})

/** Audio container/codec the provider should return. */
export type SpeechFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'

/** OpenAI's built-in voices. Any other string is passed through (custom voice ids). */
export type OpenAISpeechVoice =
  | 'alloy' | 'ash' | 'ballad' | 'cedar' | 'coral' | 'echo' | 'fable'
  | 'marin' | 'nova' | 'onyx' | 'sage' | 'shimmer' | 'verse'

interface SpeechRequestOptions {
  /** Driver to use. Defaults to `default` in `config/ai.ts`. */
  driver?: SpeechDriver
  /**
   * AI configuration to read the default driver and credentials from. Defaults
   * to the application's loaded `config/ai.ts` (`ai` from `@stacksjs/config`).
   */
  config?: ConfiguredAIOptions
  /** Retry policy for 429 / 5xx responses. */
  retry?: RetryConfig
  /** Abort the request. */
  signal?: AbortSignal
}

export interface TextToSpeechOptions extends SpeechRequestOptions {
  /** Model. OpenAI default: `gpt-4o-mini-tts` (also `tts-1`, `tts-1-hd`). */
  model?: string
  /** Voice. OpenAI default: `alloy`. */
  voice?: OpenAISpeechVoice | (string & {})
  /** Output format. Default: `mp3`. */
  format?: SpeechFormat
  /** Playback speed, 0.25 to 4.0. Omitted means the provider default (1.0). */
  speed?: number
  /** Voice direction ("speak calmly"). OpenAI: not supported by `tts-1` / `tts-1-hd`. */
  instructions?: string
}

export interface SpeechResult {
  /** The encoded audio. */
  audio: Uint8Array
  /** MIME type of `audio`, e.g. `audio/mpeg`. */
  mimeType: string
  format: SpeechFormat
  driver: AIProvider
  model: string
  voice: string
}

export type SpeechInput = Blob | Uint8Array | ArrayBuffer

export interface SpeechToTextOptions extends SpeechRequestOptions {
  /** Model. OpenAI default: `whisper-1` (also `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`). */
  model?: string
  /** ISO-639-1 language of the audio, e.g. `en`. Improves accuracy and latency. */
  language?: string
  /** Text to guide style or continue a previous segment. */
  prompt?: string
  /** Sampling temperature, 0 to 1. */
  temperature?: number
  /**
   * Filename sent with raw bytes. The provider detects the audio format from
   * its extension, so give one that matches (`clip.wav`). Default: `audio.mp3`,
   * or the name of a `File` input.
   */
  filename?: string
}

export interface TranscriptionResult {
  text: string
  driver: AIProvider
  model: string
}

/** Anything with a Stacks `StorageAdapter`-compatible `write()`. */
export interface SpeechStorageDisk {
  write: (path: string, contents: Uint8Array) => Promise<{ path: string, size: number, contentType?: string }>
}

export interface StoreSpeechOptions {
  /**
   * Disk name from `config/filesystems.ts` (`local`, `public`, `s3`, ...) or a
   * storage adapter instance. Defaults to the configured default disk.
   */
  disk?: string | SpeechStorageDisk
}

export interface StoredSpeech {
  path: string
  size: number
  mimeType: string
}

// ============================================================================
// Driver selection
// ============================================================================

/** Drivers that implement text-to-speech / speech-to-text. */
export const SPEECH_DRIVERS: readonly AIProvider[] = ['openai']

const OPENAI_BASE_URL = 'https://api.openai.com/v1'
const MAX_OPENAI_INPUT = 4096

async function loadConfig(config?: ConfiguredAIOptions): Promise<ConfiguredAIOptions> {
  if (config)
    return config
  try {
    const { ai } = await import('@stacksjs/config')
    return (ai ?? {}) as ConfiguredAIOptions
  }
  catch {
    return {}
  }
}

function unsupported(feature: string, driver: string): Error {
  return new Error(
    `${feature} is not supported by the "${driver}" AI driver. `
    + `Drivers that support it: ${SPEECH_DRIVERS.join(', ')}. `
    + `Pass { driver: '${SPEECH_DRIVERS[0]}' } or set \`default\` in config/ai.ts.`,
  )
}

function resolveSpeechDriver(feature: string, config: ConfiguredAIOptions, override?: SpeechDriver): AIProvider {
  const requested = String(override || config.default || '').trim()
  if (!requested)
    throw new Error(`${feature} needs an AI driver. Pass { driver: '${SPEECH_DRIVERS[0]}' } or set \`default\` in config/ai.ts.`)

  let provider: AIProvider
  try {
    provider = resolveAIProvider({ default: requested })
  }
  catch {
    throw unsupported(feature, requested)
  }
  if (!SPEECH_DRIVERS.includes(provider))
    throw unsupported(feature, provider)
  return provider
}

function openAICredentials(config: ConfiguredAIOptions): { apiKey: string, baseUrl: string } {
  const driver = config.drivers?.openai ?? {}
  const apiKey = driver.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || ''
  const customBase = driver.baseUrl?.trim()
  // A custom base URL may be a keyless proxy, the same rule
  // `getAIProviderConfiguration()` applies.
  if (!apiKey && !customBase)
    throw new Error('OpenAI API key not set. Set OPENAI_API_KEY or `drivers.openai.apiKey` in config/ai.ts.')
  return { apiKey, baseUrl: (customBase || OPENAI_BASE_URL).replace(/\/+$/, '') }
}

async function failure(provider: string, operation: string, response: Response): Promise<Error> {
  let body = ''
  try {
    body = (await response.text()).trim()
  }
  catch {}
  const snippet = body.length > 500 ? `${body.slice(0, 500)}...` : body
  return new Error(`${provider} ${operation} failed with HTTP ${response.status}${snippet ? `: ${snippet}` : ''}`)
}

// ============================================================================
// Text-to-speech
// ============================================================================

const MIME_TYPES: Record<SpeechFormat, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  // OpenAI returns raw 24kHz, 16-bit signed little-endian, mono samples.
  pcm: 'audio/pcm',
}

/** The MIME type for a speech format. */
export function speechMimeType(format: SpeechFormat): string {
  return MIME_TYPES[format]
}

/**
 * Synthesize speech from text.
 *
 * @example
 * ```ts
 * const speech = await textToSpeech('Your order has shipped.', { voice: 'nova' })
 * return new Response(speech.audio, { headers: { 'Content-Type': speech.mimeType } })
 * ```
 */
export async function textToSpeech(text: string, options: TextToSpeechOptions = {}): Promise<SpeechResult> {
  if (typeof text !== 'string' || !text.trim())
    throw new Error('textToSpeech() needs non-empty text.')

  const format = options.format ?? 'mp3'
  if (!(format in MIME_TYPES))
    throw new Error(`Unsupported speech format "${format}". Use one of: ${Object.keys(MIME_TYPES).join(', ')}.`)

  if (options.speed !== undefined && !(options.speed >= 0.25 && options.speed <= 4))
    throw new Error(`Speech speed must be between 0.25 and 4.0, got ${options.speed}.`)

  const config = await loadConfig(options.config)
  const driver = resolveSpeechDriver('Text-to-speech', config, options.driver)

  // Only OpenAI reaches here today; branch per driver as more are added.
  return openAITextToSpeech(text, format, options, config, driver)
}

async function openAITextToSpeech(
  text: string,
  format: SpeechFormat,
  options: TextToSpeechOptions,
  config: ConfiguredAIOptions,
  driver: AIProvider,
): Promise<SpeechResult> {
  if (text.length > MAX_OPENAI_INPUT)
    throw new Error(`OpenAI text-to-speech accepts at most ${MAX_OPENAI_INPUT} characters per request, got ${text.length}. Split the text into chunks.`)

  const model = options.model ?? 'gpt-4o-mini-tts'
  const voice = options.voice ?? 'alloy'
  if (options.instructions && /^tts-1(?:-hd)?$/.test(model))
    throw new Error(`OpenAI model "${model}" does not support \`instructions\`. Use gpt-4o-mini-tts.`)

  const { apiKey, baseUrl } = openAICredentials(config)
  const body: Record<string, unknown> = { model, input: text, voice, response_format: format }
  if (options.speed !== undefined)
    body.speed = options.speed
  if (options.instructions)
    body.instructions = options.instructions

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey)
    headers.Authorization = `Bearer ${apiKey}`

  const response = await fetchWithRetry(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  }, options.retry)

  if (!response.ok)
    throw await failure('OpenAI', 'text-to-speech', response)

  const audio = new Uint8Array(await response.arrayBuffer())
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim()
  const mimeType = contentType?.startsWith('audio/') ? contentType : MIME_TYPES[format]

  return { audio, mimeType, format, driver, model, voice }
}

/**
 * Write synthesized speech to a Stacks storage disk.
 *
 * @example
 * ```ts
 * const speech = await textToSpeech('Welcome back!')
 * await storeSpeech(speech, 'audio/welcome.mp3', { disk: 'public' })
 * ```
 */
export async function storeSpeech(
  speech: Pick<SpeechResult, 'audio' | 'mimeType'>,
  path: string,
  options: StoreSpeechOptions = {},
): Promise<StoredSpeech> {
  if (!path?.trim())
    throw new Error('storeSpeech() needs a destination path.')

  let disk: SpeechStorageDisk
  if (options.disk && typeof options.disk === 'object') {
    disk = options.disk
  }
  else {
    let storage: { Storage: { disk: (name?: string) => SpeechStorageDisk } }
    try {
      storage = await import('@stacksjs/storage') as unknown as typeof storage
    }
    catch (error) {
      throw new Error(
        `storeSpeech() needs @stacksjs/storage to resolve a disk by name (${error instanceof Error ? error.message : String(error)}). `
        + 'Install it, or pass a storage adapter as { disk }.',
      )
    }
    disk = storage.Storage.disk(options.disk || undefined)
  }

  const result = await disk.write(path, speech.audio)
  return { path: result.path, size: result.size, mimeType: speech.mimeType }
}

// ============================================================================
// Speech-to-text
// ============================================================================

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
}

/**
 * Transcribe audio to text.
 *
 * @example
 * ```ts
 * const { text } = await speechToText(Bun.file('memo.m4a'), { language: 'en' })
 * ```
 */
export async function speechToText(audio: SpeechInput, options: SpeechToTextOptions = {}): Promise<TranscriptionResult> {
  if (options.temperature !== undefined && !(options.temperature >= 0 && options.temperature <= 1))
    throw new Error(`Transcription temperature must be between 0 and 1, got ${options.temperature}.`)

  const config = await loadConfig(options.config)
  const driver = resolveSpeechDriver('Speech-to-text', config, options.driver)

  const model = options.model ?? 'whisper-1'
  const { apiKey, baseUrl } = openAICredentials(config)

  const blob = audio instanceof Blob ? audio : new Blob([audio as BlobPart])
  if (blob.size === 0)
    throw new Error('speechToText() needs non-empty audio.')

  // A `File` (or `Bun.file()`) carries a name whose extension the provider reads.
  const ownName = (audio as { name?: unknown }).name
  const fileName = options.filename
    || (typeof ownName === 'string' && ownName ? ownName.split('/').pop() : undefined)
    || `audio.${EXTENSIONS[blob.type.split(';')[0] ?? ''] ?? 'mp3'}`

  const form = new FormData()
  form.append('file', blob, fileName)
  form.append('model', model)
  form.append('response_format', 'json')
  if (options.language)
    form.append('language', options.language)
  if (options.prompt)
    form.append('prompt', options.prompt)
  if (options.temperature !== undefined)
    form.append('temperature', String(options.temperature))

  const headers: Record<string, string> = {}
  if (apiKey)
    headers.Authorization = `Bearer ${apiKey}`

  const response = await fetchWithRetry(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: form,
    signal: options.signal,
  }, options.retry)

  if (!response.ok)
    throw await failure('OpenAI', 'speech-to-text', response)

  const data = await response.json() as { text?: unknown }
  if (typeof data?.text !== 'string')
    throw new Error('OpenAI speech-to-text returned no text.')

  return { text: data.text, driver, model }
}
