/**
 * The speech decoding pipeline, shared by the worker thread and the
 * calling-thread fallback. Its result crosses `postMessage`, so failures are
 * plain data and `speech-input.ts` turns them into errors.
 */
import { AudioTooLongError, decodeAudio, encodeWav, mixChannels, resampleAudio, UnsupportedAudioCodecError } from 'ts-videos'

export interface SpeechDecodeLimits {
  maxBytes: number
  maxDurationSeconds: number
}

export type SpeechDecodeFailure =
  | { kind: 'duration' }
  | { kind: 'unsupported', format: string }
  | { kind: 'sample-rate', rate: number }
  | { kind: 'undecodable', detail?: string }

export type SpeechDecodeResult =
  | { ok: true, audio: Uint8Array, durationSeconds: number }
  | { ok: false, failure: SpeechDecodeFailure }

const SPEECH_RATE = 16000
/**
 * The highest source rate decoded. A WAV header can claim any rate, and the
 * resampler's filter grows with it: 4 GHz costs seconds and a gigabyte.
 */
const MAX_SOURCE_RATE = 192000

/**
 * Decodes an upload to 16 kHz mono 16-bit WAV, refusing it if the decoded
 * samples run past the limit, whatever its container claims. At most one
 * second of audio past the limit is decoded.
 *
 * `signal` and `deadline` (a `performance.now()` time) serve the calling-thread
 * fallback: they are checked between packets and stages, and throw the
 * signal's reason or "Audio decoder timed out". A worker is stopped from
 * outside instead and passes neither.
 */
export async function decodeSpeech(input: Uint8Array, limits: SpeechDecodeLimits, signal?: AbortSignal, deadline = Infinity): Promise<SpeechDecodeResult> {
  const { maxBytes, maxDurationSeconds: maxDuration } = limits
  const checkpoint = (): void => {
    signal?.throwIfAborted()
    if (performance.now() > deadline) throw new Error('Audio decoder timed out')
  }
  const fail = (failure: SpeechDecodeFailure): SpeechDecodeResult => ({ ok: false, failure })

  const unsupported = unsupportedFormat(input)
  if (unsupported) return fail({ kind: 'unsupported', format: unsupported })
  const ogg = scanOgg(input)
  if (ogg && ogg.codec !== 'Opus') return fail({ kind: 'unsupported', format: ogg.codec })
  // ts-videos measures an Ogg file only after decoding all of it, and keeps
  // what its last granule position claims. Count the packets instead.
  if (ogg && ogg.seconds > maxDuration + 1) return fail({ kind: 'duration' })
  checkpoint()

  let decoded: Awaited<ReturnType<typeof decodeAudio>>
  try {
    // One second past the limit: a recording that stops exactly at the limit
    // still carries the encoder's priming samples at this point.
    decoded = await decodeAudio(input, { maxBytes, maxDurationSeconds: maxDuration + 1, signal })
  }
  catch (error) {
    if (signal?.aborted) throw signal.reason
    if (error instanceof AudioTooLongError) return fail({ kind: 'duration' })
    if (error instanceof UnsupportedAudioCodecError) return fail({ kind: 'unsupported', format: error.codec })
    return fail({ kind: 'undecodable', detail: error instanceof Error ? error.message : String(error) })
  }
  checkpoint()
  if (!(decoded.sampleRate > 0 && decoded.sampleRate <= MAX_SOURCE_RATE)) return fail({ kind: 'sample-rate', rate: decoded.sampleRate })
  const samples = resampleAudio(mixChannels(decoded.channels, 1), decoded.sampleRate, SPEECH_RATE)
  const durationSeconds = (samples[0]?.length ?? 0) / SPEECH_RATE
  if (durationSeconds <= 0 || durationSeconds > maxDuration) return fail({ kind: 'duration' })
  checkpoint()
  return { ok: true, audio: encodeWav(samples, SPEECH_RATE), durationSeconds }
}

function text(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/** Formats ts-videos does not read, named so the refusal can say which it got. */
function unsupportedFormat(bytes: Uint8Array): string | null {
  if (text(bytes, 0, 4) === 'fLaC') return 'FLAC'
  if (text(bytes, 0, 5) === '#!AMR') return 'AMR'
  // An MPEG frame sync with layer bits of zero is ADTS AAC. The other layers
  // are MPEG audio: ts-videos decodes layer III (MP3) and names I and II.
  if (bytes[0] === 0xFF && ((bytes[1] ?? 0) & 0xE6) === 0xE0) return 'AAC in an ADTS stream'
  return null
}

/**
 * An Ogg upload's codec, and how long its Opus packets play. The length comes
 * from each packet's own TOC byte, never from the granule positions, which an
 * upload can set to anything. A lost (empty) packet decodes to 20 ms, so
 * without this 12 MiB of empty packets would decode to some 60 hours before
 * being measured. Reads the first logical stream, as the decoder does.
 */
function scanOgg(bytes: Uint8Array): { codec: string, seconds: number } | null {
  if (text(bytes, 0, 4) !== 'OggS') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let serial: number | undefined
  let codec = 'Ogg audio other than Opus'
  let preSkip = 0
  let samples = 0
  let packets = 0
  let start = -1
  let length = 0
  for (let page = 0; page + 27 <= bytes.length && text(bytes, page, 4) === 'OggS';) {
    const segments = bytes[page + 26]!
    let body = page + 27 + segments
    if (body > bytes.length) break
    serial ??= view.getUint32(page + 14, true)
    const ours = view.getUint32(page + 14, true) === serial
    for (let index = 0; index < segments; index++) {
      const size = bytes[page + 27 + index]!
      if (ours) {
        if (start < 0) start = body
        length += Math.max(0, Math.min(size, bytes.length - body))
        if (size < 255) {
          if (packets === 0) {
            codec = oggCodec(bytes, start, length)
            if (codec === 'Opus') preSkip = view.getUint16(start + 10, true)
          }
          // Packet 1 is OpusTags, which the decoder skips.
          else if (packets > 1) {
            samples += length ? opusPacketSamples(bytes[start]!, length > 1 ? bytes[start + 1]! : 0) : 960
          }
          packets++
          start = -1
          length = 0
        }
      }
      body += size
    }
    page = body
  }
  return { codec, seconds: Math.max(0, samples - preSkip) / 48000 }
}

function oggCodec(bytes: Uint8Array, start: number, length: number): string {
  if (length >= 19 && text(bytes, start, 8) === 'OpusHead') return 'Opus'
  if (bytes[start] === 1 && text(bytes, start + 1, 6) === 'vorbis') return 'Vorbis'
  if (bytes[start] === 0x7F && text(bytes, start + 1, 4) === 'FLAC') return 'FLAC'
  if (text(bytes, start, 8) === 'Speex   ') return 'Speex'
  return 'Ogg audio other than Opus'
}

/** The 48 kHz samples an Opus packet decodes to (RFC 6716 section 3.1), at most 120 ms. */
function opusPacketSamples(toc: number, second: number): number {
  const config = toc >> 3
  const frame = config < 12 ? [480, 960, 1920, 2880][config & 3]! : config < 16 ? (config & 1 ? 960 : 480) : [120, 240, 480, 960][config & 3]!
  const frames = (toc & 3) === 0 ? 1 : (toc & 3) === 3 ? second & 0x3F : 2
  return Math.min(5760, frame * frames)
}
