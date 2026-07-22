import { createHmac, timingSafeEqual } from 'node:crypto'

export type VideoContainer = 'mp4' | 'webm'
export type StreamingFormat = 'hls' | 'dash'
export type VideoCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1' | 'mpeg1' | 'mpeg2' | 'mpeg4' | 'theora' | 'mjpeg' | 'prores' | 'dnxhd' | 'unknown'
export type VideoAudioCodec = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'flac' | 'alac' | 'ac3' | 'eac3' | 'dts' | 'pcm_s16le' | 'pcm_s16be' | 'pcm_s24le' | 'pcm_s24be' | 'pcm_s32le' | 'pcm_s32be' | 'pcm_f32le' | 'pcm_f32be' | 'pcm_f64le' | 'pcm_f64be' | 'pcm_mulaw' | 'pcm_alaw' | 'unknown'
export interface VideoProfile { width: number, height: number, duration: number, frameRate: number, container: VideoContainer, videoCodec: VideoCodec, audioCodec?: VideoAudioCodec, videoBitrate?: number, hasAudio?: boolean, hdr?: boolean }
export interface VideoRendition { name: string, width: number, height: number, frameRate: number, videoBitrate: number, audioBitrate: number }
export interface VideoCapabilities { videoEncoder: boolean, audioEncoder: boolean, videoCodecs: string[], audioCodecs: string[] }
export interface VideoOutput { container: VideoContainer, videoCodec: VideoCodec, audioCodec?: VideoAudioCodec, action: 'copy' | 'transcode', available: boolean, reason?: string }
export interface VideoPlan { source: string, profile: VideoProfile, renditions: VideoRendition[], outputs: VideoOutput[], streaming: StreamingFormat[], segmentDuration: number, keyframeInterval: number }
export interface VideoProcessOptions { batchSize?: number, signal?: AbortSignal }
export interface ProcessedVideoDerivative { output: VideoOutput, rendition: VideoRendition, bytes: Uint8Array }
export interface PreviewCue { startTime: number, endTime: number, uri: string, x?: number, y?: number, width?: number, height?: number }
const edges = [240, 360, 480, 540, 720, 1080, 1440, 2160]
const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)
function validate(profile: VideoProfile): void {
  for (const [name, value] of Object.entries({ width: profile.width, height: profile.height, duration: profile.duration, frameRate: profile.frameRate })) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`Video ${name} must be positive`)
  }
}

export function deriveVideoLadder(profile: VideoProfile, maximum?: number): VideoRendition[] {
  validate(profile)
  const short = Math.min(profile.width, profile.height); const limit = Math.min(short, maximum ?? short)
  const targets = edges.filter(edge => edge <= limit); if (!targets.includes(limit)) targets.push(limit)
  return [...new Set(targets)].sort((a, b) => a - b).map((edge) => {
    const scale = edge / short
    const width = even(profile.width * scale)
    const height = even(profile.height * scale)
    const rate = Math.round(width * height * Math.min(60, profile.frameRate) * 0.075 * (profile.frameRate > 30 ? Math.min(2, profile.frameRate / 30) : 1) * (profile.hdr ? 1.25 : 1) / 1000) * 1000
    return { name: `${edge}p`, width, height, frameRate: profile.frameRate, videoBitrate: Math.max(250_000, Math.min(profile.videoBitrate ?? Infinity, rate)), audioBitrate: profile.hasAudio === false ? 0 : width >= 1280 ? 192_000 : 128_000 }
  }).filter((item, index, all) => item.width <= profile.width && item.height <= profile.height && all.findIndex(value => value.width === item.width && value.height === item.height) === index)
}

export class VideoBuilder {
  private inspected?: VideoProfile
  private formats: VideoContainer[] = ['mp4', 'webm']
  private streams: StreamingFormat[] = ['hls', 'dash']
  private maximum?: number
  private capabilities: VideoCapabilities = { videoEncoder: false, audioEncoder: false, videoCodecs: [], audioCodecs: [] }
  constructor(private readonly source: string) {}
  profile(value: VideoProfile): this { validate(value); this.inspected = value; return this }
  ladder(value: 'auto' | number): this { if (value !== 'auto' && (!Number.isInteger(value) || value <= 0)) throw new TypeError('Video ladder height must be positive'); this.maximum = value === 'auto' ? undefined : value; return this }
  output(formats: VideoContainer[]): this { if (!formats.length) throw new TypeError('Video formats are required'); this.formats = [...new Set(formats)]; return this }
  streaming(formats: StreamingFormat[]): this { this.streams = [...new Set(formats)]; return this }
  runtime(value: VideoCapabilities): this { this.capabilities = value; return this }
  generate(): VideoPlan {
    if (!this.inspected) throw new Error('Video inspection is required; pass its profile with .profile()')
    const profile = this.inspected; const renditions = deriveVideoLadder(profile, this.maximum)
    const outputs = this.formats.map((container): VideoOutput => {
      const videoCodec = container === 'mp4' ? 'h264' : 'vp9'; const audioCodec = profile.hasAudio === false ? undefined : container === 'mp4' ? 'aac' : 'opus'
      const original = renditions.length === 1 && renditions[0]!.width === profile.width && renditions[0]!.height === profile.height
      const copy = original && profile.container === container && profile.videoCodec === videoCodec && (!audioCodec || profile.audioCodec === audioCodec)
      const available = copy || this.capabilities.videoEncoder && this.capabilities.videoCodecs.includes(videoCodec) && (!audioCodec || this.capabilities.audioEncoder && this.capabilities.audioCodecs.includes(audioCodec))
      return { container, videoCodec, audioCodec, action: copy ? 'copy' : 'transcode', available, reason: available ? undefined : `Native ${videoCodec}${audioCodec ? `/${audioCodec}` : ''} encoding is unavailable` }
    })
    const segmentDuration = profile.duration <= 30 ? 2 : profile.duration <= 600 ? 4 : 6
    return { source: this.source, profile, renditions, outputs, streaming: this.streams, segmentDuration, keyframeInterval: Math.max(1, Math.round(profile.frameRate * segmentDuration)) }
  }
  async process(options: VideoProcessOptions = {}): Promise<ProcessedVideoDerivative[]> { return processVideoPlan(this.generate(), options) }
}
export function video(source: string): VideoBuilder { return new VideoBuilder(source) }
export async function processVideoPlan(plan: VideoPlan, options: VideoProcessOptions = {}): Promise<ProcessedVideoDerivative[]> {
  assertVideoPlanExecutable(plan)
  const { generateVideoDerivatives } = await import('ts-videos/native-transcode')
  return generateVideoDerivatives(plan.source, {
    source: plan.profile,
    renditions: plan.renditions,
    outputs: plan.outputs,
    streaming: plan.streaming,
    segmentDuration: plan.segmentDuration,
    keyframeInterval: plan.keyframeInterval,
  }, options)
}
export function assertVideoPlanExecutable(plan: VideoPlan): void {
  const missing = plan.outputs.filter(value => !value.available)
  if (missing.length) throw new Error(missing.map(value => `${value.container}: ${value.reason}`).join('; '))
}
export function createHlsMaster(plan: VideoPlan, uri: (rendition: VideoRendition) => string): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']; const output = plan.outputs.find(value => value.container === 'mp4')
  for (const item of plan.renditions) { lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${item.videoBitrate + item.audioBitrate},AVERAGE-BANDWIDTH=${Math.round((item.videoBitrate + item.audioBitrate) * .9)},RESOLUTION=${item.width}x${item.height},FRAME-RATE=${item.frameRate.toFixed(3)},CODECS="${output?.videoCodec ?? plan.profile.videoCodec}${output?.audioCodec ? `,${output.audioCodec}` : ''}"`); lines.push(uri(item)) }
  return `${lines.join('\n')}\n`
}
function time(seconds: number): string {
  const ms = Math.round(seconds * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
export function createPreviewVtt(cues: readonly PreviewCue[]): string {
  let end = 0
  const lines = ['WEBVTT', '']
  cues.forEach((cue, index) => {
    if (cue.startTime < end || cue.endTime <= cue.startTime) throw new TypeError(`Invalid preview cue ${index}`)
    const sprite = [cue.x, cue.y, cue.width, cue.height].every(value => value !== undefined)
    lines.push(`${time(cue.startTime)} --> ${time(cue.endTime)}`, sprite ? `${cue.uri}#xywh=${cue.x},${cue.y},${cue.width},${cue.height}` : cue.uri, '')
    end = cue.endTime
  })
  return lines.join('\n')
}
export function videoResponseHeaders(bytes: number, etag: string, contentType: string): Record<string, string> {
  return { 'Accept-Ranges': 'bytes', 'Content-Length': String(bytes), 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${etag}"` }
}
export function signVideoAsset(path: string, expires: number, secret: string): string {
  return createHmac('sha256', secret).update(`${path}\n${expires}`).digest('base64url')
}
export function verifyVideoAsset(path: string, expires: number, signature: string, secret: string, now: number = Date.now()): boolean { if (!Number.isInteger(expires) || expires * 1000 <= now) return false; const expected = Buffer.from(signVideoAsset(path, expires, secret)); const actual = Buffer.from(signature); return expected.length === actual.length && timingSafeEqual(expected, actual) }

export interface VideoSegment { uri: string, duration: number, data: Uint8Array }
export interface VideoHlsProtection { key: Uint8Array, keyUri: string, iv?: (_index: number) => Uint8Array }
export interface ProtectedVideoPlaylist { playlist: string, files: Record<string, Uint8Array>, encrypted: boolean }

function sequenceIv(index: number): Uint8Array { const value = new Uint8Array(16); new DataView(value.buffer).setBigUint64(8, BigInt(index)); return value }
function hex(value: Uint8Array): string { return [...value].map(byte => byte.toString(16).padStart(2, '0')).join('') }
async function encryptAes(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  if (key.byteLength !== 16 || iv.byteLength !== 16) throw new TypeError('HLS AES-128 keys and IVs must contain 16 bytes')
  const keyBytes = Uint8Array.from(key); const ivBytes = Uint8Array.from(iv); const dataBytes = Uint8Array.from(data)
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes.buffer, { name: 'AES-CBC' }, false, ['encrypt'])
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivBytes.buffer }, cryptoKey, dataBytes.buffer))
}
export async function createProtectedVideoPlaylist(segments: VideoSegment[], protection?: VideoHlsProtection): Promise<ProtectedVideoPlaylist> {
  if (!segments.length) throw new TypeError('Video playlist requires segments')
  if (protection && /[\r\n"]/.test(protection.keyUri)) throw new TypeError('Invalid video key URI')
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', `#EXT-X-TARGETDURATION:${Math.ceil(Math.max(...segments.map(item => item.duration)))}`, '#EXT-X-PLAYLIST-TYPE:VOD', '#EXT-X-INDEPENDENT-SEGMENTS']; const files: Record<string, Uint8Array> = {}
  for (const [index, segment] of segments.entries()) {
    if (!Number.isFinite(segment.duration) || segment.duration <= 0 || /[\r\n"]/.test(segment.uri)) throw new TypeError(`Invalid video segment ${index}`)
    let data = segment.data
    if (protection) { const iv = protection.iv?.(index) ?? sequenceIv(index); data = await encryptAes(data, protection.key, iv); lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="${protection.keyUri}",IV=0x${hex(iv)}`) }
    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`, segment.uri); files[segment.uri] = data
  }
  lines.push('#EXT-X-ENDLIST', '')
  return { playlist: lines.join('\n'), files, encrypted: !!protection }
}
export function videoAssetHeaders(path: string, bytes?: number, etag?: string, protectedMedia = false): Record<string, string> {
  const manifest = /\.(?:m3u8|mpd|vtt)$/i.test(path)
  const headers: Record<string, string> = { 'Accept-Ranges': 'bytes', 'Cache-Control': protectedMedia && manifest ? 'private, no-store' : manifest ? 'public, max-age=5, s-maxage=30' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }
  if (bytes !== undefined) headers['Content-Length'] = String(bytes)
  if (etag) headers.ETag = `"${etag}"`
  return headers
}
