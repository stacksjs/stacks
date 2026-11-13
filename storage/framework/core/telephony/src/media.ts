import { TelephonyError } from './errors.ts'
import { sid } from './validation.ts'

export interface MediaLimits { maxMessageBytes?: number, maxAudioBytes?: number }
export type MediaEvent = { event: 'connected', protocol: 'Call', version: '1.0.0' }
  | { event: 'start', sequenceNumber: number, streamSid: string, accountSid: string, callSid: string, tracks: ('inbound' | 'outbound')[], customParameters: Record<string, string> }
  | { event: 'media', sequenceNumber: number, streamSid: string, track: 'inbound' | 'outbound', chunk: number, timestamp: number, audio: Uint8Array }
  | { event: 'stop', sequenceNumber: number, streamSid: string, accountSid: string, callSid: string }
  | { event: 'mark', sequenceNumber: number, streamSid: string, name: string }
  | { event: 'dtmf', sequenceNumber: number, streamSid: string, digit: string }

function badMedia(): never { throw new TelephonyError('invalid_media', 'Invalid, out-of-order or oversized Media Stream event.') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badMedia()
  return value as Record<string, unknown>
}
function resource(value: unknown, prefix: string): string {
  if (typeof value !== 'string' || !new RegExp(`^${prefix}[a-f0-9]{32}$`, 'i').test(value)) badMedia()
  return value
}
function integer(value: unknown, minimum: number = 0): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) badMedia()
  return Number(value)
}
function limit(value: number | undefined, fallback: number, ceiling: number = 1048576): number {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < 1 || result > ceiling) throw new TelephonyError('configuration', 'Media limits must be positive bounded integers.')
  return result
}

/** Pure parser. Authenticate the WebSocket upgrade before accepting any message. */
export function parseMediaEvent(json: string, limits: MediaLimits = {}): MediaEvent {
  const maxMessage = limit(limits.maxMessageBytes, 65536)
  const maxAudio = limit(limits.maxAudioBytes, 8000)
  if (typeof json !== 'string' || json.length > maxMessage || Buffer.byteLength(json) > maxMessage) badMedia()
  let parsed: unknown
  try { parsed = JSON.parse(json) }
  catch { return badMedia() }
  const row = record(parsed)
  if (row.event === 'connected') {
    if (row.protocol !== 'Call' || row.version !== '1.0.0') badMedia()
    return { event: 'connected', protocol: 'Call', version: '1.0.0' }
  }
  const streamSid = resource(row.streamSid, 'MZ')
  const sequenceNumber = integer(row.sequenceNumber, 1)
  if (row.event === 'start') {
    const start = record(row.start)
    const format = record(start.mediaFormat)
    if (format.encoding !== 'audio/x-mulaw' || format.sampleRate !== 8000 || format.channels !== 1 || start.streamSid !== streamSid) badMedia()
    if (!Array.isArray(start.tracks) || start.tracks.length < 1 || start.tracks.length > 2 || start.tracks.some(track => track !== 'inbound' && track !== 'outbound')) badMedia()
    const custom = record(start.customParameters ?? {})
    if (Object.keys(custom).length > 20 || Object.entries(custom).some(([key, value]) => typeof value !== 'string' || key.length + value.length >= 500)) badMedia()
    return { event: 'start', sequenceNumber, streamSid, accountSid: resource(start.accountSid, 'AC'), callSid: resource(start.callSid, 'CA'), tracks: start.tracks as ('inbound' | 'outbound')[], customParameters: custom as Record<string, string> }
  }
  if (row.event === 'media') {
    const media = record(row.media)
    if (media.track !== 'inbound' && media.track !== 'outbound') badMedia()
    const payload = media.payload
    if (typeof payload !== 'string' || !payload || payload.length > Math.ceil(maxAudio / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) badMedia()
    const audio = Buffer.from(payload, 'base64')
    if (audio.length > maxAudio || audio.toString('base64') !== payload) badMedia()
    return { event: 'media', sequenceNumber, streamSid, track: media.track, chunk: integer(media.chunk, 1), timestamp: integer(media.timestamp), audio }
  }
  if (row.event === 'stop') {
    const stop = record(row.stop)
    return { event: 'stop', sequenceNumber, streamSid, accountSid: resource(stop.accountSid, 'AC'), callSid: resource(stop.callSid, 'CA') }
  }
  if (row.event === 'mark') {
    const name = record(row.mark).name
    if (typeof name !== 'string' || name.length < 1 || name.length > 500) badMedia()
    return { event: 'mark', sequenceNumber, streamSid, name }
  }
  if (row.event === 'dtmf') {
    const dtmf = record(row.dtmf)
    if (dtmf.track !== 'inbound_track' || typeof dtmf.digit !== 'string' || !/^[0-9*#]$/.test(dtmf.digit)) badMedia()
    return { event: 'dtmf', sequenceNumber, streamSid, digit: dtmf.digit }
  }
  return badMedia()
}

export interface MediaSessionOptions extends MediaLimits {
  accountSid: string
  callSid: string
  /** Default 30 minutes at 8000 bytes/sec. No audio is accumulated by the session. */
  maxTotalAudioBytes?: number
}
/** Per-WebSocket state: bind a signed connection to its expected account/call and reject replays or mixed streams. */
export class MediaStreamSession {
  private stage: 'new' | 'connected' | 'started' | 'stopped' = 'new'
  private streamSid: string | undefined
  private sequence: number = 0
  private audioBytes: number = 0
  private readonly maxTotal: number
  private readonly options: MediaSessionOptions
  private tracks: ('inbound' | 'outbound')[] = []
  constructor(options: MediaSessionOptions) {
    sid(options.accountSid, 'AC')
    sid(options.callSid, 'CA')
    this.options = { ...options }
    this.maxTotal = limit(options.maxTotalAudioBytes, 14400000, 8000 * 60 * 60 * 24)
    limit(options.maxMessageBytes, 65536)
    limit(options.maxAudioBytes, 8000)
  }

  accept(json: string): MediaEvent {
    const event = parseMediaEvent(json, this.options)
    if (event.event === 'connected') {
      if (this.stage !== 'new') badMedia()
      this.stage = 'connected'
      return event
    }
    if (event.sequenceNumber !== this.sequence + 1) badMedia()
    if (event.event === 'start') {
      if (this.stage !== 'connected' || event.accountSid !== this.options.accountSid || event.callSid !== this.options.callSid) badMedia()
      this.streamSid = event.streamSid
      this.tracks = [...event.tracks]
      this.stage = 'started'
    }
    else {
      if (this.stage !== 'started' || event.streamSid !== this.streamSid) badMedia()
      if (event.event === 'media') {
        if (!this.tracks.includes(event.track) || this.audioBytes + event.audio.byteLength > this.maxTotal) badMedia()
        this.audioBytes += event.audio.byteLength
      }
      if (event.event === 'stop') {
        if (event.accountSid !== this.options.accountSid || event.callSid !== this.options.callSid) badMedia()
        this.stage = 'stopped'
      }
    }
    this.sequence = event.sequenceNumber
    return event
  }
}

/** Outbound raw mu-law audio. This encodes bytes; it does not transcode PCM/WAV or validate a codec. */
export function mediaMessage(streamSid: string, audio: Uint8Array, maxAudioBytes: number = 8000): string {
  sid(streamSid, 'MZ')
  if (!(audio instanceof Uint8Array) || audio.byteLength < 1 || audio.byteLength > limit(maxAudioBytes, 8000)) badMedia()
  return JSON.stringify({ event: 'media', streamSid, media: { payload: Buffer.from(audio).toString('base64') } })
}
export function clearMediaMessage(streamSid: string): string {
  return JSON.stringify({ event: 'clear', streamSid: sid(streamSid, 'MZ') })
}
export function markMediaMessage(streamSid: string, name: string): string {
  if (!name || name.length > 500) badMedia()
  return JSON.stringify({ event: 'mark', streamSid: sid(streamSid, 'MZ'), mark: { name } })
}

/** Explicit backpressure: overflow throws without dropping accepted audio. The caller must pause or close the stream. */
export class AudioQueue {
  private readonly frames: Uint8Array[] = []
  private bytes: number = 0
  private readonly maxBytes: number
  private readonly maxFrames: number
  constructor(options: { maxBytes?: number, maxFrames?: number } = {}) {
    this.maxBytes = limit(options.maxBytes, 64000)
    this.maxFrames = limit(options.maxFrames, 400, 10000)
  }

  get byteLength(): number { return this.bytes }
  get length(): number { return this.frames.length }
  push(audio: Uint8Array): void {
    if (!(audio instanceof Uint8Array) || audio.byteLength < 1) badMedia()
    if (this.frames.length >= this.maxFrames || this.bytes + audio.byteLength > this.maxBytes) throw new TelephonyError('capacity', 'Audio queue is full. Apply backpressure or close the stream.')
    this.frames.push(new Uint8Array(audio))
    this.bytes += audio.byteLength
  }

  shift(): Uint8Array | undefined {
    const frame = this.frames.shift()
    if (frame) this.bytes -= frame.byteLength
    return frame
  }

  clear(): void { this.frames.length = 0; this.bytes = 0 }
}
