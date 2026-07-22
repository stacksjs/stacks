import { createHmac, timingSafeEqual } from 'node:crypto'

export type AudioFormat = 'opus' | 'aac' | 'mp3'
export type AudioContent = 'speech' | 'music' | 'general'
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'flac' | 'alac' | 'pcm_s16le' | 'pcm_s24le' | 'pcm_s32le' | 'pcm_f32le' | 'pcm_f64le'
export interface AudioProfile { codec: AudioCodec, container: string, duration: number, sampleRate: number, channels: number, bitrate?: number }
export interface AudioCapabilities { encoder: boolean, codecs: AudioFormat[] }
export interface AudioOutput { format: AudioFormat, container: 'ogg' | 'aac' | 'mp3', mimeType: 'audio/ogg; codecs=opus' | 'audio/aac' | 'audio/mpeg', extension: 'ogg' | 'aac' | 'mp3', bitrate: number, action: 'copy' | 'transcode', available: boolean, reason?: string }
export interface AudioPlan { source: string, profile: AudioProfile, outputs: AudioOutput[], loudness: number }
export interface AudioProcessOptions { batchSize?: number, signal?: AbortSignal }
export interface ProcessedAudioDerivative { output: AudioOutput, bytes: Uint8Array }
export interface Waveform { version: 1, channels: number, sampleRate: number, duration: number, samplesPerPeak: number, peaks: number[][] }
export interface TranscriptSegment { startTime: number, endTime: number, text: string, confidence?: number, speaker?: string }
export interface Transcript { language: string, segments: Array<TranscriptSegment & { id: number }>, vtt: string }
const details: Record<AudioFormat, Pick<AudioOutput, 'container' | 'mimeType' | 'extension'>> = { opus: { container: 'ogg', mimeType: 'audio/ogg; codecs=opus', extension: 'ogg' }, aac: { container: 'aac', mimeType: 'audio/aac', extension: 'aac' }, mp3: { container: 'mp3', mimeType: 'audio/mpeg', extension: 'mp3' } }
function validate(profile: AudioProfile): void {
  for (const [name, value] of Object.entries({ duration: profile.duration, sampleRate: profile.sampleRate, channels: profile.channels })) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`Audio ${name} must be positive`)
  }
}

export function recommendAudioBitrate(format: AudioFormat, source: AudioProfile, content: AudioContent): number {
  const channels = Math.min(2, Math.max(1, source.channels)); const rate = source.sampleRate <= 24000 ? .75 : source.sampleRate >= 88200 ? 1.15 : 1
  const base = content === 'speech' ? channels === 1 ? 48000 : 64000 : content === 'music' ? channels === 1 ? 96000 : 192000 : channels === 1 ? 64000 : 128000
  return Math.max(32000, Math.min(source.bitrate ?? Infinity, Math.round(base * rate * (format === 'opus' ? .8 : format === 'mp3' ? 1.2 : 1) / 1000) * 1000))
}
export class AudioBuilder {
  private inspected?: AudioProfile; private formats: AudioFormat[] = ['opus', 'aac', 'mp3']; private contentType: AudioContent = 'general'; private targetLoudness = -16; private capabilities: AudioCapabilities = { encoder: false, codecs: [] }
  constructor(private readonly source: string) {}
  profile(value: AudioProfile): this { validate(value); this.inspected = value; return this }
  output(value: AudioFormat[]): this { if (!value.length) throw new TypeError('Audio formats are required'); this.formats = [...new Set(value)]; return this }
  content(value: AudioContent): this { this.contentType = value; return this }
  loudness(value: number): this { if (!Number.isFinite(value) || value < -70 || value > 0) throw new TypeError('Audio loudness must be between -70 and 0 LUFS'); this.targetLoudness = value; return this }
  runtime(value: AudioCapabilities): this { this.capabilities = value; return this }
  generate(): AudioPlan {
    if (!this.inspected) throw new Error('Audio inspection is required; pass its profile with .profile()')
    const profile = this.inspected; const outputs = this.formats.map((format): AudioOutput => { const info = details[format]; const copy = profile.codec === format && (profile.container === info.container || profile.container === info.extension); const available = copy || this.capabilities.encoder && this.capabilities.codecs.includes(format); return { format, ...info, bitrate: recommendAudioBitrate(format, profile, this.contentType), action: copy ? 'copy' : 'transcode', available, reason: available ? undefined : `Native ${format} encoding is unavailable` } })
    return { source: this.source, profile, outputs, loudness: this.targetLoudness }
  }
  async process(options: AudioProcessOptions = {}): Promise<ProcessedAudioDerivative[]> { return processAudioPlan(this.generate(), options) }
}
export function audio(source: string): AudioBuilder { return new AudioBuilder(source) }
export async function processAudioPlan(plan: AudioPlan, options: AudioProcessOptions = {}): Promise<ProcessedAudioDerivative[]> {
  assertAudioPlanExecutable(plan)
  const { generateAudioDerivatives } = await import('ts-audio/native-transcode')
  return generateAudioDerivatives(plan.source, { source: plan.profile, outputs: plan.outputs }, options)
}
export function assertAudioPlanExecutable(plan: AudioPlan): void {
  const missing = plan.outputs.filter(value => !value.available)
  if (missing.length) throw new Error(missing.map(value => `${value.format}: ${value.reason}`).join('; '))
}
function q(accept: string, mime: string): number {
  const [type = '', subtype = ''] = (mime.split(';', 1)[0] ?? '').split('/')
  let best = 0
  for (const item of accept.split(',')) {
    const [range = '*/*', ...params] = item.trim().toLowerCase().split(';').map(value => value.trim())
    const [a = '*', b = '*'] = range.split('/')
    if ((a === '*' || a === type) && (b === '*' || b === subtype)) {
      const raw = params.find(value => value.startsWith('q='))
      best = Math.max(best, raw ? Number.parseFloat(raw.slice(2)) || 0 : 1)
    }
  }
  return best
}
export function negotiateAudioOutput(outputs: readonly AudioOutput[], accept = '*/*'): AudioOutput | undefined {
  return outputs.filter(value => value.available).map((output, index) => ({ output, index, q: q(accept || '*/*', output.mimeType) })).filter(value => value.q > 0).sort((a, b) => b.q - a.q || a.index - b.index)[0]?.output
}
export function createWaveform(channels: readonly Float32Array[], sampleRate: number, samples = 1000, precision = 4): Waveform {
  if (!channels.length || sampleRate <= 0) throw new TypeError('Waveform requires channels and a positive sample rate'); const frames = channels[0]!.length; if (channels.some(channel => channel.length !== frames)) throw new TypeError('Waveform channels must have equal lengths')
  const size = Math.max(1, Math.ceil(frames / Math.max(1, Math.min(frames || 1, Math.floor(samples))))); let absolute = 0
  const raw = channels.map((channel) => { const peaks: Array<[number, number]> = []; for (let start = 0; start < frames; start += size) { let min = 1; let max = -1; for (let index = start; index < Math.min(frames, start + size); index++) { const sample = channel[index] ?? 0; const value = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0; min = Math.min(min, value); max = Math.max(max, value); absolute = Math.max(absolute, Math.abs(value)) } peaks.push([min, max]) } return peaks }); const divisor = absolute || 1; const round = (value: number): number => Number((value / divisor).toFixed(Math.max(0, Math.min(6, precision))))
  return { version: 1, channels: channels.length, sampleRate, duration: frames / sampleRate, samplesPerPeak: size, peaks: raw.map(channel => channel.flatMap(([min, max]) => [round(min), round(max)])) }
}
function time(seconds: number): string {
  const ms = Math.round(seconds * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
export function normalizeTranscript(language: string, input: readonly TranscriptSegment[]): Transcript {
  if (!language.trim()) throw new TypeError('Transcript language is required')
  let end = 0
  const segments = input.map((item, index) => {
    if (item.startTime < end || item.startTime < 0 || item.endTime <= item.startTime || !item.text.trim()) throw new TypeError(`Invalid transcript segment ${index}`)
    if (item.confidence !== undefined && (item.confidence < 0 || item.confidence > 1)) throw new TypeError(`Invalid transcript confidence ${index}`)
    end = item.endTime
    return { ...item, text: item.text.trim(), id: index + 1 }
  })
  const lines = ['WEBVTT', '']
  for (const item of segments) lines.push(String(item.id), `${time(item.startTime)} --> ${time(item.endTime)}`, item.speaker ? `<v ${item.speaker}>${item.text}` : item.text, '')
  return { language: language.trim().toLowerCase(), segments, vtt: lines.join('\n') }
}
export function audioResponseHeaders(bytes: number, etag: string, contentType: string): Record<string, string> {
  return { 'Accept-Ranges': 'bytes', 'Content-Length': String(bytes), 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${etag}"`, 'Vary': 'Accept' }
}
export function signAudioAsset(path: string, expires: number, secret: string): string {
  return createHmac('sha256', secret).update(`${path}\n${expires}`).digest('base64url')
}
export function verifyAudioAsset(path: string, expires: number, signature: string, secret: string, now: number = Date.now()): boolean { if (!Number.isInteger(expires) || expires * 1000 <= now) return false; const expected = Buffer.from(signAudioAsset(path, expires, secret)); const actual = Buffer.from(signature); return expected.length === actual.length && timingSafeEqual(expected, actual) }

export interface AudioSegment { uri: string, duration: number, data: Uint8Array }
export interface AudioHlsProtection { key: Uint8Array, keyUri: string }
export async function createProtectedAudioPlaylist(segments: AudioSegment[], protection?: AudioHlsProtection): Promise<{ playlist: string, files: Record<string, Uint8Array>, encrypted: boolean }> {
  if (!segments.length) throw new TypeError('Audio playlist requires segments')
  if (protection && /[\r\n"]/.test(protection.keyUri)) throw new TypeError('Invalid audio key URI')
  const files: Record<string, Uint8Array> = {}; const lines = ['#EXTM3U', '#EXT-X-VERSION:7', `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...segments.map(item => item.duration)))}`, '#EXT-X-PLAYLIST-TYPE:VOD']
  for (const [index, segment] of segments.entries()) {
    if (!Number.isFinite(segment.duration) || segment.duration <= 0 || /[\r\n"]/.test(segment.uri)) throw new TypeError(`Invalid audio segment ${index}`)
    let data = segment.data
    if (protection) {
      if (protection.key.byteLength !== 16) throw new TypeError('Audio HLS AES-128 key must contain 16 bytes')
      const iv = new Uint8Array(16)
      new DataView(iv.buffer).setBigUint64(8, BigInt(index))
      const key = Uint8Array.from(protection.key)
      const input = Uint8Array.from(data)
      const cryptoKey = await crypto.subtle.importKey('raw', key.buffer, { name: 'AES-CBC' }, false, ['encrypt'])
      data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv.buffer }, cryptoKey, input.buffer))
      const ivHex = [...iv].map(byte => byte.toString(16).padStart(2, '0')).join('')
      lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="${protection.keyUri}",IV=0x${ivHex}`)
    }
    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`, segment.uri); files[segment.uri] = data
  }
  lines.push('#EXT-X-ENDLIST', ''); return { playlist: lines.join('\n'), files, encrypted: !!protection }
}
