import { createHmac, timingSafeEqual } from 'node:crypto'
export type VideoContainer = 'mp4' | 'webm'
export type StreamingFormat = 'hls' | 'dash'
export interface VideoProfile { width: number, height: number, duration: number, frameRate: number, container: VideoContainer, videoCodec: string, audioCodec?: string, videoBitrate?: number, hasAudio?: boolean, hdr?: boolean }
export interface VideoRendition { name: string, width: number, height: number, frameRate: number, videoBitrate: number, audioBitrate: number }
export interface VideoCapabilities { videoEncoder: boolean, audioEncoder: boolean, videoCodecs: string[], audioCodecs: string[] }
export interface VideoOutput { container: VideoContainer, videoCodec: string, audioCodec?: string, action: 'copy' | 'transcode', available: boolean, reason?: string }
export interface VideoPlan { source: string, profile: VideoProfile, renditions: VideoRendition[], outputs: VideoOutput[], streaming: StreamingFormat[], segmentDuration: number, keyframeInterval: number }
export interface PreviewCue { startTime: number, endTime: number, uri: string, x?: number, y?: number, width?: number, height?: number }
const edges = [240, 360, 480, 540, 720, 1080, 1440, 2160]
const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)
function validate(profile: VideoProfile): void { for (const [name, value] of Object.entries({ width: profile.width, height: profile.height, duration: profile.duration, frameRate: profile.frameRate })) if (!Number.isFinite(value) || value <= 0) throw new TypeError(`Video ${name} must be positive`) }

export function deriveVideoLadder(profile: VideoProfile, maximum?: number): VideoRendition[] {
  validate(profile)
  const short = Math.min(profile.width, profile.height); const limit = Math.min(short, maximum ?? short)
  const targets = edges.filter(edge => edge <= limit); if (!targets.includes(limit)) targets.push(limit)
  return [...new Set(targets)].sort((a, b) => a - b).map((edge) => {
    const scale = edge / short; const width = even(profile.width * scale); const height = even(profile.height * scale)
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
}
export function video(source: string): VideoBuilder { return new VideoBuilder(source) }
export function assertVideoPlanExecutable(plan: VideoPlan): void { const missing = plan.outputs.filter(value => !value.available); if (missing.length) throw new Error(missing.map(value => `${value.container}: ${value.reason}`).join('; ')) }
export function createHlsMaster(plan: VideoPlan, uri: (rendition: VideoRendition) => string): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS']; const output = plan.outputs.find(value => value.container === 'mp4')
  for (const item of plan.renditions) { lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${item.videoBitrate + item.audioBitrate},AVERAGE-BANDWIDTH=${Math.round((item.videoBitrate + item.audioBitrate) * .9)},RESOLUTION=${item.width}x${item.height},FRAME-RATE=${item.frameRate.toFixed(3)},CODECS="${output?.videoCodec ?? plan.profile.videoCodec}${output?.audioCodec ? `,${output.audioCodec}` : ''}"`); lines.push(uri(item)) }
  return `${lines.join('\n')}\n`
}
function time(seconds: number): string { const ms = Math.round(seconds * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0')}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}` }
export function createPreviewVtt(cues: readonly PreviewCue[]): string { let end = 0; const lines = ['WEBVTT', '']; cues.forEach((cue, index) => { if (cue.startTime < end || cue.endTime <= cue.startTime) throw new TypeError(`Invalid preview cue ${index}`); const sprite = [cue.x, cue.y, cue.width, cue.height].every(value => value !== undefined); lines.push(`${time(cue.startTime)} --> ${time(cue.endTime)}`, sprite ? `${cue.uri}#xywh=${cue.x},${cue.y},${cue.width},${cue.height}` : cue.uri, ''); end = cue.endTime }); return lines.join('\n') }
export function videoResponseHeaders(bytes: number, etag: string, contentType: string): Record<string, string> { return { 'Accept-Ranges': 'bytes', 'Content-Length': String(bytes), 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': `"${etag}"` } }
export function signVideoAsset(path: string, expires: number, secret: string): string { return createHmac('sha256', secret).update(`${path}\n${expires}`).digest('base64url') }
export function verifyVideoAsset(path: string, expires: number, signature: string, secret: string, now: number = Date.now()): boolean { if (!Number.isInteger(expires) || expires * 1000 <= now) return false; const expected = Buffer.from(signVideoAsset(path, expires, secret)); const actual = Buffer.from(signature); return expected.length === actual.length && timingSafeEqual(expected, actual) }
