import type { SpeechDecodeFailure, SpeechDecodeLimits, SpeechDecodeResult } from './speech-decode'
import type { SpeechDecodeJob } from './speech-decode-worker'
import { decodeSpeech } from './speech-decode'

/** Decode untrusted voice uploads before billing or sending them to a speech provider. */
export interface SpeechAudioOptions {
  maxBytes?: number
  maxDurationSeconds?: number
  timeoutMs?: number
  signal?: AbortSignal
  /**
   * @deprecated Ignored. Speech audio is decoded in-process by ts-videos, so
   * no external decoder runs.
   */
  decoderPath?: string
}

export interface PreparedSpeechAudio {
  audio: Uint8Array
  mimeType: 'audio/wav'
  durationSeconds: number
}

const DURATION_ERROR = 'Audio duration exceeds the recording limit or is empty'
const UNDECODABLE = 'The uploaded audio could not be decoded'
const SUPPORTED = 'Record AAC (M4A), Opus (WebM or Ogg) or WAV.'
const TIMED_OUT = 'Audio decoder timed out'

/**
 * Decodes an upload to 16 kHz mono 16-bit WAV and refuses it if the decoded
 * samples run past the limit, whatever its container claims.
 *
 * The decode runs in a worker thread, so the event loop stays free, and the
 * deadline or `signal` terminates it mid-decode. Where the worker cannot load
 * (an app bundled into one file, a runtime without `Worker`), it decodes on
 * the calling thread instead, checking both between packets and stages.
 */
export async function prepareSpeechAudio(input: Uint8Array, options: SpeechAudioOptions = {}): Promise<PreparedSpeechAudio> {
  const maxBytes = options.maxBytes ?? 12 * 1024 * 1024
  const maxDuration = options.maxDurationSeconds ?? 300
  const timeout = options.timeoutMs ?? 30_000
  if (![maxBytes, maxDuration, timeout].every(value => Number.isSafeInteger(value) && value > 0) || maxDuration > 3600) throw new TypeError('Invalid speech audio limits')
  // ts-videos reads a string as a path or URL: an upload is only ever bytes.
  if (!(input instanceof Uint8Array)) throw new TypeError('Speech audio must be the uploaded bytes')
  if (!input.length || input.length > maxBytes) throw new Error('Audio size exceeds the upload limit or is empty')
  options.signal?.throwIfAborted()
  const limits: SpeechDecodeLimits = { maxBytes, maxDurationSeconds: maxDuration }
  const deadline = performance.now() + timeout
  const result = await decodeInWorker(input, limits, timeout, options.signal) ?? await decodeOnCallingThread(input, limits, deadline, options.signal)
  if (!result.ok) throw failureError(result.failure)
  return { audio: result.audio, mimeType: 'audio/wav', durationSeconds: result.durationSeconds }
}

function failureError(failure: SpeechDecodeFailure): Error {
  switch (failure.kind) {
    case 'duration': return new Error(DURATION_ERROR)
    case 'unsupported': return new Error(`${UNDECODABLE}: ${failure.format} is not supported. ${SUPPORTED}`)
    case 'sample-rate': return new Error(`${UNDECODABLE}: a ${failure.rate} Hz sample rate is not supported`)
    case 'undecodable': return new Error(UNDECODABLE, failure.detail ? { cause: new Error(failure.detail) } : undefined)
  }
}

/**
 * One worker per decode, terminated when it answers, at the deadline or on
 * abort. Resolves null when the worker cannot start, before it said `ready`.
 */
function decodeInWorker(input: Uint8Array, limits: SpeechDecodeLimits, timeout: number, signal?: AbortSignal): Promise<SpeechDecodeResult | null> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      if (typeof Worker !== 'function') throw new TypeError('This runtime has no Worker')
      worker = new Worker(new URL('./speech-decode-worker.ts', import.meta.url))
    }
    catch (error) {
      resolve(unavailable(error))
      return
    }
    let ready = false
    let settled = false
    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
      finish()
    }
    const timer = setTimeout(() => settle(() => reject(new Error(TIMED_OUT))), timeout)
    const onAbort = (): void => settle(() => reject(signal!.reason))
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', ({ data }: MessageEvent<SpeechDecodeResult | { ready: true }>) => {
      if ('ready' in data) {
        ready = true
        // A copy, transferred: the caller's bytes (a Buffer may share a pooled
        // slab) must not be detached.
        const copy = new Uint8Array(input)
        const job: SpeechDecodeJob = { input: copy.buffer, ...limits }
        worker.postMessage(job, [copy.buffer])
        return
      }
      settle(() => resolve(data))
    })
    worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault()
      settle(() => resolve(ready ? { ok: false, failure: { kind: 'undecodable', detail: event.message } } : unavailable(event.message)))
    })
    worker.addEventListener('messageerror', () => settle(() => resolve({ ok: false, failure: { kind: 'undecodable', detail: 'The decoder worker sent an unreadable result' } })))
    worker.addEventListener('close', () => settle(() => resolve(ready ? { ok: false, failure: { kind: 'undecodable', detail: 'The decoder worker stopped without a result' } } : unavailable('it exited while loading'))))
  })
}

let warnedUnavailable = false
function unavailable(reason: unknown): null {
  if (!warnedUnavailable) {
    warnedUnavailable = true
    const detail = reason instanceof Error ? reason.message : String(reason)
    console.warn(`@stacksjs/audio: the speech decoding worker could not start (${detail}). Speech uploads are decoded on the calling thread, which holds the event loop while they decode.`)
  }
  return null
}

async function decodeOnCallingThread(input: Uint8Array, limits: SpeechDecodeLimits, deadline: number, signal?: AbortSignal): Promise<SpeechDecodeResult> {
  try {
    return await decodeSpeech(input, limits, signal, deadline)
  }
  catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof Error && error.message === TIMED_OUT) throw error
    return { ok: false, failure: { kind: 'undecodable', detail: error instanceof Error ? error.message : String(error) } }
  }
}
