import { AudioTooLongError, decodeAudio, encodeWav, mixChannels, resampleAudio, UnsupportedAudioCodecError } from 'ts-videos'

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

const SPEECH_RATE = 16000
/**
 * The highest source rate decoded. A WAV header can claim any rate, and the
 * resampler's filter grows with it: 4 GHz costs seconds and a gigabyte.
 */
const MAX_SOURCE_RATE = 192000
const DURATION_ERROR = 'Audio duration exceeds the recording limit or is empty'
const UNDECODABLE = 'The uploaded audio could not be decoded'
const SUPPORTED = 'Record AAC (M4A), Opus (WebM or Ogg) or WAV.'

/**
 * Decodes an upload to 16 kHz mono 16-bit WAV and refuses it if the decoded
 * samples run past the limit, whatever its container claims.
 *
 * Decoding runs on the calling thread. It checks `signal` and the deadline
 * between packets, but the deadline can only fire there and between stages,
 * so it cannot cut one decode short. That is safe because the work is bounded:
 * at most one second of audio past the limit is ever decoded.
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
  const deadline = performance.now() + timeout
  const timer = AbortSignal.timeout(timeout)
  const signal = options.signal ? AbortSignal.any([options.signal, timer]) : timer
  const checkpoint = (): void => {
    options.signal?.throwIfAborted()
    if (timer.aborted || performance.now() > deadline) throw new Error('Audio decoder timed out')
  }

  const unsupported = unsupportedFormat(input)
  if (unsupported) throw new Error(`${UNDECODABLE}: ${unsupported} is not supported. ${SUPPORTED}`)
  const ogg = scanOgg(input)
  if (ogg && ogg.codec !== 'Opus') throw new Error(`${UNDECODABLE}: ${ogg.codec} is not supported. ${SUPPORTED}`)
  // ts-videos measures an Ogg file only after decoding all of it, and keeps
  // what its last granule position claims. Count the packets instead.
  if (ogg && ogg.seconds > maxDuration + 1) throw new Error(DURATION_ERROR)

  let decoded: Awaited<ReturnType<typeof decodeAudio>>
  try {
    // One second past the limit, as before: a recording that stops exactly at
    // the limit still carries the encoder's priming samples at this point.
    decoded = await decodeAudio(input, { maxBytes, maxDurationSeconds: maxDuration + 1, signal })
  }
  catch (error) {
    if (options.signal?.aborted) throw options.signal.reason
    if (timer.aborted) throw new Error('Audio decoder timed out', { cause: error })
    if (error instanceof AudioTooLongError) throw new Error(DURATION_ERROR, { cause: error })
    if (error instanceof UnsupportedAudioCodecError) throw new Error(`${UNDECODABLE}: ${error.codec} is not supported. ${SUPPORTED}`, { cause: error })
    throw new Error(UNDECODABLE, { cause: error })
  }
  checkpoint()
  if (!(decoded.sampleRate > 0 && decoded.sampleRate <= MAX_SOURCE_RATE)) throw new Error(`${UNDECODABLE}: a ${decoded.sampleRate} Hz sample rate is not supported`)
  const samples = resampleAudio(mixChannels(decoded.channels, 1), decoded.sampleRate, SPEECH_RATE)
  const durationSeconds = (samples[0]?.length ?? 0) / SPEECH_RATE
  if (durationSeconds <= 0 || durationSeconds > maxDuration) throw new Error(DURATION_ERROR)
  checkpoint()
  return { audio: encodeWav(samples, SPEECH_RATE), mimeType: 'audio/wav', durationSeconds }
}

function text(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/** Formats ts-videos does not read, named so the refusal can say which it got. */
function unsupportedFormat(bytes: Uint8Array): string | null {
  if (text(bytes, 0, 4) === 'fLaC') return 'FLAC'
  if (text(bytes, 0, 5) === '#!AMR') return 'AMR'
  if (text(bytes, 0, 3) === 'ID3') return 'MP3'
  // An MPEG audio frame sync: layer bits of zero are ADTS AAC, the rest MP3.
  if (bytes[0] === 0xFF && ((bytes[1] ?? 0) & 0xE0) === 0xE0) return ((bytes[1] ?? 0) & 0x06) === 0 ? 'AAC in an ADTS stream' : 'MP3'
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
